import tsResults from "ts-results";
const { Ok, Err } = tsResults;
import type { Result } from "ts-results";
import OpenAI from "openai";
import { readFile } from "node:fs/promises";
import type { AnalysisResult, AnalysisError } from "../types/analysis.js";
import { getGlobalLogger } from "../utils/logger.js";

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
  private logger = getGlobalLogger();
  private maxRetries = 3;
  private retryDelay = 1000; // milliseconds
  private timeout = 30_000; // 30 seconds

  constructor(apiKey: string) {
    this.openai = new OpenAI({
      apiKey,
      httpAgent: this.createHttpAgent(),
    });
  }

  private createHttpAgent() {
    // This would be used for custom timeouts if needed
    return undefined;
  }

  /**
   * Analyzes a screenshot using OpenAI's vision model
   */
  async analyzeScreenshot(
    options: VisionAnalysisOptions
  ): Promise<Result<AnalysisResult, AnalysisError>> {
    this.logger.info("Starting vision analysis", { viewport: options.viewport });
    this.logger.debug("Vision options", options);

    // Convert image to base64
    const base64Result = await this.imageToBase64(options.imagePath);
    if (base64Result.err) {
      return Err(base64Result.val);
    }

    // Call OpenAI and handle the response
    return this.callOpenAI(base64Result.val, options);
  }

  private async callOpenAI(
    base64Image: string,
    options: VisionAnalysisOptions
  ): Promise<Result<AnalysisResult, AnalysisError>> {
    // Implement retry logic with exponential backoff
    let lastError: unknown;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      if (attempt > 0) {
        // Exponential backoff
        const delay = this.retryDelay * Math.pow(2, attempt - 1);
        this.logger.info(
          `Retrying request after ${delay}ms (attempt ${attempt}/${this.maxRetries})`
        );
        await new Promise((resolve) => globalThis.setTimeout(resolve, delay));
      }

      try {
        this.logger.debug(
          `Attempting OpenAI request (attempt ${attempt + 1}/${this.maxRetries + 1})`
        );

        // Create a promise race between the request and a timeout
        const timeoutPromise = new Promise<never>((_, reject) => {
          globalThis.setTimeout(() => reject(new Error("Request timeout")), this.timeout);
        });

        const completionPromise = this.makeOpenAIRequest(base64Image, options.viewport);
        const completion = await Promise.race([completionPromise, timeoutPromise]);

        return this.processOpenAIResponse(completion, options.viewport);
      } catch (error) {
        lastError = error;
        this.logger.warn(`OpenAI request failed (attempt ${attempt + 1}/${this.maxRetries + 1})`, {
          error,
        });

        // Don't retry if it's a client error (4xx)
        if (
          error instanceof OpenAI.APIError &&
          error.status &&
          error.status >= 400 &&
          error.status < 500
        ) {
          return this.handleError(error);
        }
      }
    }

    // All retries exhausted
    return this.handleError(lastError);
  }

  private async makeOpenAIRequest(
    base64Image: string,
    viewport: string
  ): Promise<OpenAI.Chat.Completions.ChatCompletion> {
    const systemPrompt = this.createSystemPrompt(viewport);
    this.logger.debug("Created system prompt", { viewport });
    this.logger.debug("Calling OpenAI vision API");

    return this.openai.chat.completions.create({
      model: "gpt-image-1",
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
  }

  private processOpenAIResponse(
    completion: OpenAI.Chat.Completions.ChatCompletion,
    viewport: string
  ): Result<AnalysisResult, AnalysisError> {
    const analysis = completion.choices[0]?.message?.content;
    this.logger.debug("Received response from OpenAI", { hasContent: !!analysis });

    if (!analysis) {
      this.logger.error("No analysis content received from OpenAI");
      return Err({
        type: "ANALYSIS_ERROR",
        code: "INVALID_RESPONSE",
        message: "No analysis content received from OpenAI",
      } as AnalysisError);
    }

    this.logger.info("Vision analysis completed successfully");

    return Ok({
      content: analysis,
      timestamp: new Date().toISOString(),
      viewport,
      model: "gpt-image-1",
    });
  }

  private handleError(error: unknown): Result<AnalysisResult, AnalysisError> {
    this.logger.error("Vision analysis failed", { error });

    if (error instanceof OpenAI.APIError) {
      const code = this.getApiErrorCode(error.status);

      return Err({
        type: "API_ERROR",
        code,
        message: `OpenAI API error: ${error.message}`,
        status: error.status,
      } as AnalysisError);
    }

    return Err({
      type: "ANALYSIS_ERROR",
      code: "PROCESSING_FAILED",
      message: error instanceof Error ? error.message : "Unknown error during analysis",
    } as AnalysisError);
  }

  private getApiErrorCode(status: number | undefined): string {
    if (status === 429) return "RATE_LIMIT";
    if (status === 401) return "INVALID_KEY";
    if (status && status >= 500) return "SERVER_ERROR";
    return "NETWORK_ERROR";
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
- Broken layouts or misaligned elements
- Text that's unreadable or overlapping
- Images that are distorted or improperly sized
- Interactive elements that appear broken or unusable
- Missing critical content or navigation elements
- Accessibility issues that would prevent usage
- Clear user experience blockers

Avoid minor suggestions about aesthetics unless they significantly impact usability.`;
  }

  /**
   * Converts an image file to base64 string
   */
  private async imageToBase64(imagePath: string): Promise<Result<string, AnalysisError>> {
    try {
      this.logger.debug("Reading image file", { imagePath });
      const imageBuffer = await readFile(imagePath);
      const base64String = imageBuffer.toString("base64");
      this.logger.debug("Image converted to base64", { length: base64String.length });
      return Ok(base64String);
    } catch (error) {
      this.logger.error("Failed to convert image to base64", { error, imagePath });
      return Err({
        type: "FILE_SYSTEM_ERROR",
        code: "READ_ERROR",
        message: `Failed to read image file: ${error instanceof Error ? error.message : "Unknown error"}`,
        path: imagePath,
      } as AnalysisError);
    }
  }
}
