import { exec } from "node:child_process";
import { promisify } from "node:util";
import { tmpdir } from "node:os";
import path from "node:path";
import { readFile, unlink } from "node:fs/promises";
import { existsSync } from "node:fs";
import { Result, Ok, Err } from "ts-results";
import type { ScreenshotOptions, ScreenshotResult, ScreenshotError } from "../types/screenshot.js";
import { getGlobalLogger } from "../utils/logger.js";

const execAsync = promisify(exec);

export class ScreenshotService {
  private logger = getGlobalLogger();

  async capture(options: ScreenshotOptions): Promise<Result<ScreenshotResult, ScreenshotError>> {
    try {
      this.logger.debug("Starting screenshot capture", options);

      // Validate URL format
      const urlValidation = this.validateUrl(options.url);
      if (urlValidation.err) {
        this.logger.error("URL validation failed", urlValidation.val);
        return Err(urlValidation.val);
      }

      // Generate output path if not provided
      const outputPath = options.outputPath ?? this.generateTempPath(options.url);
      this.logger.debug("Using output path", { outputPath });

      // Build command
      const command = this.buildCommand(options, outputPath);
      this.logger.debug("Screenshot command", { command });
      this.logger.debug("Executing command", { command });

      // Execute screenshotter
      try {
        await execAsync(command);
      } catch (execError) {
        return Err({
          type: "SCREENSHOT_ERROR" as const,
          message: "Failed to capture screenshot",
          code: "CAPTURE_FAILED",
          details: execError,
        });
      }

      // Verify output file exists
      if (!existsSync(outputPath)) {
        return Err({
          type: "SCREENSHOT_ERROR" as const,
          message: "Screenshot file was not created",
          code: "CAPTURE_FAILED",
        });
      }

      // Read file and encode to base64
      const base64 = await this.encodeToBase64(outputPath);

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

      this.logger.debug("Screenshot captured successfully", result);
      return Ok(result);
    } catch (error) {
      return Err({
        type: "SCREENSHOT_ERROR" as const,
        message: "Unexpected error during screenshot capture",
        code: "CAPTURE_FAILED",
        details: error,
      });
    }
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
      const buffer = await readFile(filePath);
      return buffer.toString("base64");
    } catch (error) {
      throw new Error(`Failed to encode file to base64: ${error}`);
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
