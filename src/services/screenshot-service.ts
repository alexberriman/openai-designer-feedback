import { exec } from "node:child_process";
import { promisify } from "node:util";
import { tmpdir } from "node:os";
import path from "node:path";
import { readFile, unlink } from "node:fs/promises";
import { existsSync } from "node:fs";
import tsResults from "ts-results";
const { Ok, Err } = tsResults;
import type { Result } from "ts-results";
import type { ScreenshotOptions, ScreenshotResult, ScreenshotError } from "../types/screenshot.js";
import { getGlobalLogger } from "../utils/logger.js";

const execAsync = promisify(exec);

export class ScreenshotService {
  private logger = getGlobalLogger();

  /**
   * Validates the URL and captures a screenshot
   */
  async capture(options: ScreenshotOptions): Promise<Result<ScreenshotResult, ScreenshotError>> {
    try {
      this.logCaptureStart(options);

      // Validate URL format
      const urlValidation = this.validateUrl(options.url);
      if (urlValidation.err) {
        this.logUrlValidationError(options.url, urlValidation.val);
        return Err(urlValidation.val);
      }

      // Generate output path if not provided
      const outputPath = options.outputPath ?? this.generateTempPath(options.url);
      this.logOutputPath(outputPath, !!options.outputPath);

      // Take the screenshot
      const captureResult = await this.executeScreenshotCapture(options, outputPath);
      if (captureResult.err) {
        return captureResult;
      }

      // Verify and process the screenshot file
      return this.processScreenshotFile(outputPath, options);
    } catch (error) {
      return this.handleUnexpectedError(error);
    }
  }

  /**
   * Log capture starting information
   */
  private logCaptureStart(options: ScreenshotOptions): void {
    this.logger.debug("Starting screenshot capture", {
      url: options.url,
      viewport: options.viewport,
      waitTime: options.waitTime,
      waitFor: options.waitFor,
      fullPage: options.fullPage,
      quality: options.quality,
      outputPathProvided: !!options.outputPath,
    });
  }

  /**
   * Log URL validation error
   */
  private logUrlValidationError(url: string, error: ScreenshotError): void {
    this.logger.error("URL validation failed", {
      url,
      error: error.message,
      code: error.code,
    });
  }

  /**
   * Log output path information
   */
  private logOutputPath(outputPath: string, providedByUser: boolean): void {
    this.logger.debug("Using output path", {
      outputPath,
      isTemporary: !providedByUser,
      directory: path.dirname(outputPath),
      extension: path.extname(outputPath),
    });
  }

  /**
   * Execute the screenshot capture process
   */
  private async executeScreenshotCapture(
    options: ScreenshotOptions,
    outputPath: string
  ): Promise<Result<void, ScreenshotError>> {
    const command = this.buildCommand(options, outputPath);
    this.logger.debug("Screenshotter command", {
      command,
      commandLength: command.length,
    });

    this.logger.debug("Executing screenshotter command", {
      startTime: new Date().toISOString(),
      workingDirectory: process.cwd(),
    });

    try {
      const startTime = Date.now();
      const execResult = await execAsync(command);
      const duration = Date.now() - startTime;

      this.logger.debug("Screenshotter command completed", {
        duration: `${duration}ms`,
        stdout: execResult.stdout.slice(0, 200) + (execResult.stdout.length > 200 ? "..." : ""),
        stderr: execResult.stderr.slice(0, 200) + (execResult.stderr.length > 200 ? "..." : ""),
        exitCode: 0,
      });

      return Ok.EMPTY;
    } catch (execError) {
      return this.handleExecError(
        execError as Error & { stdout?: string; stderr?: string; code?: number },
        command
      );
    }
  }

  /**
   * Handle execution error
   */
  private handleExecError(
    error: Error & { stdout?: string; stderr?: string; code?: number },
    command: string
  ): Result<void, ScreenshotError> {
    this.logger.error("Screenshotter command failed", {
      error: error.message,
      stdout:
        error.stdout?.slice(0, 200) + (error.stdout && error.stdout.length > 200 ? "..." : ""),
      stderr:
        error.stderr?.slice(0, 200) + (error.stderr && error.stderr.length > 200 ? "..." : ""),
      exitCode: error.code,
      command,
    });

    return Err({
      type: "SCREENSHOT_ERROR" as const,
      message: `Failed to capture screenshot: ${error.message}`,
      code: "CAPTURE_FAILED",
      details: {
        stdout: error.stdout,
        stderr: error.stderr,
        exitCode: error.code,
      },
    });
  }

  /**
   * Process the screenshot file
   */
  private async processScreenshotFile(
    outputPath: string,
    options: ScreenshotOptions
  ): Promise<Result<ScreenshotResult, ScreenshotError>> {
    // Verify output file exists
    const fileExists = existsSync(outputPath);
    this.logger.debug("Checking screenshot file", {
      path: outputPath,
      exists: fileExists,
    });

    if (!fileExists) {
      return this.handleMissingFile(outputPath);
    }

    // Read file and encode to base64
    try {
      return await this.createScreenshotResult(outputPath, options);
    } catch (fileError) {
      return this.handleFileProcessingError(outputPath, fileError);
    }
  }

  /**
   * Handle missing file error
   */
  private handleMissingFile(outputPath: string): Result<ScreenshotResult, ScreenshotError> {
    this.logger.error("Screenshot file not created", {
      path: outputPath,
      directory: path.dirname(outputPath),
      directoryExists: existsSync(path.dirname(outputPath)),
    });

    return Err({
      type: "SCREENSHOT_ERROR" as const,
      message: "Screenshot file was not created",
      code: "CAPTURE_FAILED",
      path: outputPath,
    });
  }

  /**
   * Create the screenshot result from the file
   */
  private async createScreenshotResult(
    outputPath: string,
    options: ScreenshotOptions
  ): Promise<Result<ScreenshotResult, ScreenshotError>> {
    const fileStats = await readFile(outputPath)
      .then((buffer) => ({
        sizeBytes: buffer.length,
        exists: true,
      }))
      .catch((error) => ({
        error: error.message,
        exists: false,
      }));

    this.logger.debug("Screenshot file stats", fileStats);

    const base64 = await this.encodeToBase64(outputPath);
    this.logger.debug("Image encoded to base64", {
      base64Length: base64.length,
      encodedSizeKB: Math.round(base64.length / 1024),
    });

    const result: ScreenshotResult = {
      path: outputPath,
      metadata: {
        viewportSize: options.viewport || "desktop",
        timestamp: Date.now(),
        url: options.url,
        format: outputPath.endsWith(".png") ? "png" : "jpeg",
      },
      base64,
    };

    this.logger.info("Screenshot captured successfully", {
      path: outputPath,
      sizeKB: Math.round((base64.length * 0.75) / 1024), // Approximate size of decoded image
      format: result.metadata.format,
      viewport: result.metadata.viewportSize,
    });

    return Ok(result);
  }

  /**
   * Handle file processing error
   */
  private handleFileProcessingError(
    outputPath: string,
    fileError: unknown
  ): Result<ScreenshotResult, ScreenshotError> {
    this.logger.error("Failed to process screenshot file", {
      path: outputPath,
      error: fileError instanceof Error ? fileError.message : String(fileError),
    });

    return Err({
      type: "SCREENSHOT_ERROR" as const,
      message: "Failed to process screenshot file",
      code: "READ_ERROR",
      details: fileError,
    });
  }

  /**
   * Handle unexpected errors
   */
  private handleUnexpectedError(error: unknown): Result<ScreenshotResult, ScreenshotError> {
    this.logger.error("Unexpected error during screenshot capture", {
      error:
        error instanceof Error
          ? {
              name: error.name,
              message: error.message,
              stack: error.stack,
            }
          : String(error),
    });

    return Err({
      type: "SCREENSHOT_ERROR" as const,
      message: "Unexpected error during screenshot capture",
      code: "CAPTURE_FAILED",
      details: error,
    });
  }

  private validateUrl(url: string): Result<void, ScreenshotError> {
    try {
      new URL(url);
      return Ok.EMPTY;
    } catch {
      return Err({
        type: "SCREENSHOT_ERROR",
        code: "INVALID_URL",
        message: "Invalid URL format",
      } as ScreenshotError);
    }
  }

  private generateTempPath(url: string): string {
    const timestamp = Date.now();
    const safeName = url.replaceAll(/[^a-z0-9]/gi, "-").toLowerCase();
    const filename = `screenshot-${safeName}-${timestamp}.png`;
    return path.join(tmpdir(), filename);
  }

  private buildCommand(options: ScreenshotOptions, outputPath: string): string {
    const parts = ["npx", "@alexberriman/screenshotter", `"${options.url}"`];

    parts.push("-o", `"${outputPath}"`);

    if (options.viewport) {
      parts.push("-v", options.viewport);
    }

    if (options.waitTime !== undefined) {
      parts.push("-w", options.waitTime.toString());
    }

    if (options.waitFor) {
      parts.push("--wait-for", `"${options.waitFor}"`);
    }

    if (options.quality !== undefined) {
      parts.push("--quality", options.quality.toString());
    }

    if (!options.fullPage) {
      parts.push("--no-full-page");
    }

    return parts.join(" ");
  }

  private async encodeToBase64(filePath: string): Promise<string> {
    try {
      this.logger.debug("Reading file for base64 encoding", { filePath });
      const startTime = Date.now();
      const buffer = await readFile(filePath);
      const duration = Date.now() - startTime;

      this.logger.debug("File read for base64 encoding", {
        filePath,
        sizeBytes: buffer.length,
        readDuration: `${duration}ms`,
      });

      const base64 = buffer.toString("base64");

      this.logger.debug("Base64 encoding complete", {
        filePath,
        originalSizeBytes: buffer.length,
        encodedLength: base64.length,
        encodingRatio: (base64.length / buffer.length).toFixed(2),
      });

      return base64;
    } catch (error) {
      this.logger.error("Failed to encode file to base64", {
        filePath,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

      throw new Error(
        `Failed to encode file to base64: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async cleanup(filePath: string): Promise<Result<void, ScreenshotError>> {
    try {
      if (existsSync(filePath)) {
        await unlink(filePath);
        this.logger.debug("Cleaned up screenshot file", { path: filePath });
      }
      return Ok.EMPTY;
    } catch (error) {
      return Err({
        type: "SCREENSHOT_ERROR" as const,
        message: "Failed to cleanup screenshot file",
        code: "CAPTURE_FAILED",
        details: error,
      });
    }
  }
}
