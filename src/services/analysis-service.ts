import { Result, Ok, Err } from "ts-results";
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
  async analyzeWebsite(options: AnalysisOptions): Promise<Result<AnalysisResult, AnalysisError>> {
    const startTime = Date.now();
    this.logger.info("Starting website analysis", { url: options.url, viewport: options.viewport });
    this.logger.debug("Analysis options", options);

    // Take screenshot
    const screenshotOptions: ScreenshotOptions = {
      url: options.url,
      viewport: options.viewport,
      // Use temp file if no output path specified
      outputPath: options.outputPath || `/tmp/design-feedback-${Date.now()}.jpg`,
      quality: 90,
      fullPage: false,
    };

    this.logger.debug("Capturing screenshot", screenshotOptions);
    const screenshotResult = await this.screenshotService.capture(screenshotOptions);

    if (screenshotResult.err) {
      this.logger.error("Screenshot capture failed", screenshotResult.val);
      return Err(screenshotResult.val);
    }

    const screenshot = screenshotResult.val;
    const isTemporary = !options.outputPath;
    this.logger.debug("Screenshot captured successfully", { path: screenshot.path, isTemporary });

    try {
      // Analyze screenshot with vision API
      this.logger.debug("Starting vision analysis");
      const analysisResult = await this.visionService.analyzeScreenshot({
        imagePath: screenshot.path,
        viewport: options.viewport,
        apiKey: options.apiKey,
      });

      if (analysisResult.err) {
        this.logger.error("Vision analysis failed", analysisResult.val);
        return Err(analysisResult.val);
      }

      const analysis = analysisResult.val;
      this.logger.debug("Vision analysis completed successfully");

      // Add metadata
      const enrichedResult: AnalysisResult = {
        ...analysis,
        analysisTime: Date.now() - startTime,
        screenshotPath: screenshot.path,
        url: options.url,
      };

      this.logger.info("Website analysis completed", {
        duration: enrichedResult.analysisTime,
        url: options.url,
      });

      return Ok(enrichedResult);
    } finally {
      // Clean up temporary screenshot if needed
      if (isTemporary) {
        try {
          await rm(screenshot.path);
          this.logger.debug("Temporary screenshot cleaned up", { path: screenshot.path });
        } catch (error) {
          this.logger.warn("Failed to clean up temporary screenshot", {
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
