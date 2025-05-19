import { Result, Ok, Err } from "ts-results";
import type { AnalysisResult, AnalysisError, AnalysisOptions } from "../types/analysis.js";
import type { ScreenshotOptions } from "../types/screenshot.js";
import { ScreenshotService } from "./screenshot-service.js";
import { VisionService } from "./vision-service.js";
import { logger } from "../utils/logger.js";
import { rm } from "node:fs/promises";

/**
 * Service that orchestrates screenshot capture and AI analysis
 */
export class AnalysisService {
  private screenshotService: ScreenshotService;
  private visionService: VisionService;

  constructor(apiKey: string) {
    this.screenshotService = new ScreenshotService();
    this.visionService = new VisionService(apiKey);
  }

  /**
   * Analyzes a website by taking a screenshot and running vision analysis
   */
  async analyzeWebsite(options: AnalysisOptions): Promise<Result<AnalysisResult, AnalysisError>> {
    const startTime = Date.now();
    logger.info("Starting website analysis", { url: options.url, viewport: options.viewport });

    // Take screenshot
    const screenshotOptions: ScreenshotOptions = {
      url: options.url,
      viewport: options.viewport,
      // Use temp file if no output path specified
      outputPath: options.outputPath || `/tmp/design-feedback-${Date.now()}.jpg`,
      quality: 90,
      fullPage: false,
    };

    const screenshotResult = await this.screenshotService.capture(screenshotOptions);

    if (screenshotResult.err) {
      return Err({
        type: "ANALYSIS_FAILED",
        message: `Screenshot capture failed: ${screenshotResult.val.message}`,
      });
    }

    const screenshot = screenshotResult.val;
    const isTemporary = !options.outputPath;

    try {
      // Analyze screenshot with vision API
      const analysisResult = await this.visionService.analyzeScreenshot({
        imagePath: screenshot.path,
        viewport: options.viewport,
        apiKey: options.apiKey,
      });

      if (analysisResult.err) {
        return Err(analysisResult.val);
      }

      const analysis = analysisResult.val;

      // Add metadata
      const enrichedResult: AnalysisResult = {
        ...analysis,
        analysisTime: Date.now() - startTime,
        screenshotPath: screenshot.path,
        url: options.url,
      };

      logger.info("Website analysis completed", {
        duration: enrichedResult.analysisTime,
        url: options.url,
      });

      return Ok(enrichedResult);
    } finally {
      // Clean up temporary screenshot if needed
      if (isTemporary) {
        try {
          await rm(screenshot.path);
          logger.debug("Temporary screenshot cleaned up", { path: screenshot.path });
        } catch (error) {
          logger.warn("Failed to clean up temporary screenshot", {
            path: screenshot.path,
            error,
          });
        }
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
