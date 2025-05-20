import tsResults from "ts-results";
const { Ok, Err } = tsResults;
import type { Result } from "ts-results";
import type { AnalysisResult, AnalysisError, AnalysisOptions } from "../types/analysis.js";
import type { ScreenshotOptions } from "../types/screenshot.js";
import { ScreenshotService } from "./screenshot-service.js";
import { VisionService } from "./vision-service.js";
import { getGlobalLogger } from "../utils/logger.js";
import { rm } from "node:fs/promises";

/**
 * Service that orchestrates screenshot capture and AI analysis
 */
export class AnalysisService {
  private screenshotService: ScreenshotService;
  private visionService: VisionService;
  private logger = getGlobalLogger();

  constructor(apiKey: string) {
    this.screenshotService = new ScreenshotService();
    this.visionService = new VisionService(apiKey);
  }

  /**
   * Analyzes a website by taking a screenshot and running vision analysis
   */
  /**
   * Log analysis start information
   */
  private logAnalysisStart(options: AnalysisOptions): void {
    this.logger.info("Starting website analysis", {
      url: options.url,
      viewport: options.viewport,
    });

    this.logger.debug("Analysis options", options);

    const apiKeyType = options.apiKey.startsWith("sk-proj-")
      ? "Project-scoped key"
      : "Standard API key";

    this.logger.debug("Analysis run details", {
      timestamp: new Date().toISOString(),
      url: options.url,
      viewport: options.viewport,
      apiKeyPrefix: options.apiKey.slice(0, 7) + "...",
      apiKeyType,
      outputFormat: options.outputFormat || "default",
    });
  }

  /**
   * Create screenshot options from analysis options
   */
  private createScreenshotOptions(options: AnalysisOptions): ScreenshotOptions {
    return {
      url: options.url,
      viewport: options.viewport,
      // Use temp file if no output path specified
      outputPath: options.outputPath || `/tmp/design-feedback-${Date.now()}.jpg`,
      quality: 90,
      fullPage: false,
    };
  }

  /**
   * Run vision analysis on screenshot
   */
  private async analyzeImage(
    screenshotPath: string,
    options: AnalysisOptions
  ): Promise<Result<AnalysisResult, AnalysisError>> {
    this.logger.debug("Starting vision analysis");

    try {
      return await this.visionService.analyzeScreenshot({
        imagePath: screenshotPath,
        viewport: options.viewport,
        apiKey: options.apiKey,
      });
    } catch (error) {
      // Log critical errors properly
      this.logger.error("Critical error in vision service", {
        errorType: error instanceof Error ? error.constructor.name : typeof error,
        errorMessage: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : "No stack trace",
      });

      // Convert to proper error format
      return Err({
        type: "ANALYSIS_ERROR",
        code: "PROCESSING_FAILED",
        message: `Vision analysis failed with unexpected error: ${error instanceof Error ? error.message : String(error)}`,
        details: error instanceof Error ? error.stack : undefined,
      });
    }
  }

  /**
   * Cleanup temporary screenshot file
   */
  private async cleanupTemporaryFile(path: string): Promise<void> {
    try {
      await rm(path);
      this.logger.debug("Temporary screenshot cleaned up", { path });
    } catch (error) {
      this.logger.warn("Failed to clean up temporary screenshot", {
        path,
        error,
      });
    }
  }

  /**
   * Create enriched analysis result with metadata
   */
  private createEnrichedResult(
    analysis: AnalysisResult,
    screenshotPath: string,
    url: string,
    startTime: number
  ): AnalysisResult {
    const enrichedResult: AnalysisResult = {
      ...analysis,
      analysisTime: Date.now() - startTime,
      screenshotPath,
      url,
    };

    this.logger.info("Website analysis completed", {
      duration: enrichedResult.analysisTime,
      url,
    });

    return enrichedResult;
  }

  /**
   * Analyzes a website by taking a screenshot and running vision analysis
   */
  async analyzeWebsite(options: AnalysisOptions): Promise<Result<AnalysisResult, AnalysisError>> {
    const startTime = Date.now();
    this.logAnalysisStart(options);

    // Take screenshot
    const screenshotOptions = this.createScreenshotOptions(options);
    this.logger.debug("Capturing screenshot", screenshotOptions);

    const screenshotResult = await this.screenshotService.capture(screenshotOptions);
    if (screenshotResult.err) {
      this.logger.error("Screenshot capture failed", screenshotResult.val);
      return Err(screenshotResult.val);
    }

    const screenshot = screenshotResult.val;
    const isTemporary = !options.outputPath;
    this.logger.debug("Screenshot captured successfully", {
      path: screenshot.path,
      isTemporary,
    });

    try {
      // Analyze screenshot with vision API
      const analysisResult = await this.analyzeImage(screenshot.path, options);
      if (analysisResult.err) {
        this.logger.error("Vision analysis failed", analysisResult.val);
        return Err(analysisResult.val);
      }

      this.logger.debug("Vision analysis completed successfully");
      return Ok(
        this.createEnrichedResult(analysisResult.val, screenshot.path, options.url, startTime)
      );
    } finally {
      // Clean up temporary screenshot if needed
      if (isTemporary) {
        await this.cleanupTemporaryFile(screenshot.path);
      }
    }
  }

  /**
   * Updates the API key for the vision service
   */
  updateApiKey(apiKey: string): void {
    this.visionService = new VisionService(apiKey);
  }
}
