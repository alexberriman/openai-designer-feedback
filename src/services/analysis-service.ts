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
    this.logger.infoObject("Starting website analysis", {
      url: options.url,
      viewport: options.viewport,
    });

    this.logger.debugObject("Analysis options", options);

    const apiKeyType = options.apiKey.startsWith("sk-proj-")
      ? "Project-scoped key"
      : "Standard API key";

    this.logger.debugObject("Analysis run details", {
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
      fullPage: options.fullPage,
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
      // We only perform the basic analysis in this method
      return await this.visionService.analyzeScreenshot({
        imagePath: screenshotPath,
        viewport: options.viewport,
        apiKey: options.apiKey,
      });
    } catch (error) {
      // Log critical errors properly
      this.logger.errorObject("Critical error in vision service", {
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
      this.logger.debugObject("Temporary screenshot cleaned up", { path });
    } catch (error) {
      this.logger.warnObject("Failed to clean up temporary screenshot", {
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

    // Log additional details about design recommendations if present
    if (analysis.designRecommendations) {
      this.logger.infoObject("Design recommendations included in analysis", {
        recommendationsLength: analysis.designRecommendations.length,
        preview: analysis.designRecommendations.slice(0, 50) + "...",
      });
    }

    this.logger.infoObject("Website analysis completed", {
      duration: enrichedResult.analysisTime,
      url,
      hasDesignRecommendations: !!analysis.designRecommendations,
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
    this.logger.debugObject("Capturing screenshot", screenshotOptions);

    const screenshotResult = await this.screenshotService.capture(screenshotOptions);
    if (screenshotResult.err) {
      this.logger.errorObject("Screenshot capture failed", screenshotResult.val);
      return Err(screenshotResult.val);
    }

    const screenshot = screenshotResult.val;
    const isTemporary = !options.outputPath;
    this.logger.debugObject("Screenshot captured successfully", {
      path: screenshot.path,
      isTemporary,
    });

    try {
      // Analyze screenshot with vision API
      const analysisResult = await this.analyzeImage(screenshot.path, options);
      if (analysisResult.err) {
        this.logger.errorObject("Vision analysis failed", analysisResult.val);
        return Err(analysisResult.val);
      }

      let result = analysisResult.val;

      // If design recommendations are requested, fetch them
      if (options.includeDesignRecommendations) {
        this.logger.debug("Requesting design recommendations");
        const designResult = await this.getDesignRecommendations(screenshot.path, options);

        if (designResult.ok) {
          // Extract the recommendations string from the design result and add it to the main result
          if (designResult.val.designRecommendations) {
            result = {
              ...result,
              designRecommendations: designResult.val.designRecommendations,
            };
            this.logger.debug("Design recommendations merged with analysis result");
          }
        } else {
          // Log error but continue with the main analysis
          this.logger.warnObject("Failed to get design recommendations", designResult.val);
        }
      }

      this.logger.debug("Vision analysis completed successfully");
      const resultObj = this.createEnrichedResult(result, screenshot.path, options.url, startTime);
      return Ok(resultObj);
    } finally {
      try {
        // Clean up temporary screenshot if needed
        if (isTemporary) {
          await this.cleanupTemporaryFile(screenshot.path);
        }

        // Clean up OpenAI resources to allow proper termination
        await this.visionService.destroy();
        this.logger.debug("All resources cleaned up");
      } catch (cleanupError) {
        this.logger.warnObject("Error during cleanup", {
          error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
        });
      }
    }
  }

  /**
   * Gets design recommendations for a screenshot
   */
  private async getDesignRecommendations(
    screenshotPath: string,
    options: AnalysisOptions
  ): Promise<Result<AnalysisResult, AnalysisError>> {
    this.logger.debug("Starting design recommendations analysis");

    // Create a dedicated vision service for recommendations to avoid cleanup conflicts
    const recommendationsService = new VisionService(options.apiKey);

    try {
      // Call the design recommendations method from the dedicated vision service
      const result = await recommendationsService.getDesignRecommendations({
        imagePath: screenshotPath,
        viewport: options.viewport,
        apiKey: options.apiKey,
        isDesignRecommendation: true,
      });

      // Return the result directly
      return result;
    } catch (error) {
      // Log errors but don't fail the whole analysis
      this.logger.warnObject("Error in design recommendations service", {
        errorType: error instanceof Error ? error.constructor.name : typeof error,
        errorMessage: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : "No stack trace",
      });

      // Convert to proper error format
      return Err({
        type: "ANALYSIS_ERROR",
        code: "DESIGN_RECOMMENDATIONS_FAILED",
        message: `Design recommendations analysis failed: ${error instanceof Error ? error.message : String(error)}`,
        details: error instanceof Error ? error.stack : undefined,
      } as AnalysisError);
    } finally {
      // Clean up the dedicated vision service
      await recommendationsService.destroy();
      this.logger.debug("Design recommendations service cleaned up");
    }
  }

  /**
   * Updates the API key for the vision service
   */
  updateApiKey(apiKey: string): void {
    this.visionService = new VisionService(apiKey);
  }
}
