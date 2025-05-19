import { Result, Ok, Err } from "ts-results";
import OpenAI from "openai";
import { readFile } from "node:fs/promises";
import type { AnalysisResult, AnalysisError } from "../types/analysis.js";
import { logger } from "../utils/logger.js";

/**
 * Options for vision analysis
 */
interface VisionAnalysisOptions {
  imagePath: string;
  viewport: string;
  apiKey: string;
}

/**
 * Service for analyzing screenshots using OpenAI's gpt-image-1 vision model
 */
export class VisionService {
  private openai: OpenAI;

  constructor(apiKey: string) {
    this.openai = new OpenAI({ apiKey });
  }

  /**
   * Analyzes a screenshot using OpenAI's vision model
   */
  async analyzeScreenshot(
    options: VisionAnalysisOptions
  ): Promise<Result<AnalysisResult, AnalysisError>> {
    try {
      logger.info("Starting vision analysis", { viewport: options.viewport });

      // Convert image to base64
      const base64Result = await this.imageToBase64(options.imagePath);
      if (base64Result.err) {
        return Err(base64Result.val);
      }

      const base64Image = base64Result.val;

      // Create system prompt
      const systemPrompt = this.createSystemPrompt(options.viewport);

      // Call OpenAI vision API
      const completion = await this.openai.chat.completions.create({
        model: "gpt-4-vision-preview",
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Please analyze this website screenshot and identify critical design issues, errors, and fundamental problems.",
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${base64Image}`,
                },
              },
            ],
          },
        ],
        max_tokens: 1000,
        temperature: 0.7,
      });

      const analysis = completion.choices[0]?.message?.content;

      if (!analysis) {
        return Err({
          type: "ANALYSIS_FAILED",
          message: "No analysis content received from OpenAI",
        });
      }

      logger.info("Vision analysis completed successfully");

      return Ok({
        content: analysis,
        timestamp: new Date().toISOString(),
        viewport: options.viewport,
        model: "gpt-4-vision-preview",
      });
    } catch (error) {
      logger.error("Vision analysis failed", { error });

      if (error instanceof OpenAI.APIError) {
        return Err({
          type: "API_ERROR",
          message: `OpenAI API error: ${error.message}`,
          code: error.status,
        });
      }

      return Err({
        type: "ANALYSIS_FAILED",
        message: error instanceof Error ? error.message : "Unknown error during analysis",
      });
    }
  }

  /**
   * Creates the system prompt for the vision model
   */
  private createSystemPrompt(viewport: string): string {
    return `You are an experienced web designer and UX expert reviewing website screenshots. 
Focus on identifying critical issues, errors, and fundamental problems rather 
than minor UI improvements. Consider the device context (${viewport}) when 
analyzing. Provide clear, actionable feedback about actual problems.

Key areas to focus on:
- Layout breaking or overlapping elements
- Text readability issues
- Broken images or missing content
- Navigation problems
- Accessibility violations
- Mobile responsiveness issues (if applicable)
- Clear user experience blockers

Avoid minor suggestions about aesthetics unless they significantly impact usability.`;
  }

  /**
   * Converts an image file to base64 string
   */
  private async imageToBase64(imagePath: string): Promise<Result<string, AnalysisError>> {
    try {
      const imageBuffer = await readFile(imagePath);
      const base64String = imageBuffer.toString("base64");
      return Ok(base64String);
    } catch (error) {
      logger.error("Failed to convert image to base64", { error, imagePath });
      return Err({
        type: "FILE_ERROR",
        message: `Failed to read image file: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    }
  }
}

/**
 * Creates a new vision service instance
 */
export function createVisionService(apiKey: string): VisionService {
  return new VisionService(apiKey);
}
