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
 * Interface type for OpenAI request payload
 * Based on OpenAI SDK's ChatCompletionCreateParamsNonStreaming type
 */
type OpenAIRequestPayload = {
  model: string;
  messages: OpenAI.Chat.ChatCompletionMessageParam[];
  max_tokens: number;
  temperature: number;
};

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

  /**
   * Main method to call OpenAI API with built-in retry logic
   */
  private async callOpenAI(
    base64Image: string,
    options: VisionAnalysisOptions
  ): Promise<Result<AnalysisResult, AnalysisError>> {
    this.logApiCallStart(base64Image, options);

    // Implement retry logic with exponential backoff
    let lastError: unknown;

    // Try initial request and potential retries
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      // Handle backoff for retries
      if (attempt > 0) {
        await this.handleRetryBackoff(attempt);
      }

      // Try the API request
      const requestResult = await this.attemptApiRequest(attempt, base64Image, options);

      // If successful, return the result
      if (requestResult.ok) {
        return requestResult.val;
      }

      // Save error for potential retry or final error return
      lastError = requestResult.val;

      // Handle certain errors that should not be retried
      if (this.shouldNotRetry(lastError)) {
        return this.handleError(lastError);
      }
    }

    // All retries exhausted
    this.logger.error("All retry attempts exhausted", {
      attempts: this.maxRetries + 1,
    });
    return this.handleError(lastError);
  }

  /**
   * Log the start of an API call sequence
   */
  private logApiCallStart(base64Image: string, options: VisionAnalysisOptions): void {
    this.logger.debug("Starting OpenAI API call sequence", {
      imageSize: base64Image.length,
      maxRetries: this.maxRetries,
      timeout: this.timeout,
      viewport: options.viewport,
      apiKeyPrefix: options.apiKey.slice(0, 7) + "...", // Log only prefix of API key for debugging
    });
  }

  /**
   * Handle retry backoff delay
   */
  private async handleRetryBackoff(attempt: number): Promise<void> {
    const delay = this.retryDelay * Math.pow(2, attempt - 1);
    this.logger.info(`Retrying request after ${delay}ms (attempt ${attempt}/${this.maxRetries})`);
    await new Promise((resolve) => globalThis.setTimeout(resolve, delay));
  }

  /**
   * Check if error indicates we should not retry
   */
  private shouldNotRetry(error: unknown): boolean {
    return (
      error instanceof OpenAI.APIError &&
      error.status !== undefined &&
      error.status >= 400 &&
      error.status < 500
    );
  }

  /**
   * Attempt a single API request
   */
  private async attemptApiRequest(
    attempt: number,
    base64Image: string,
    options: VisionAnalysisOptions
  ): Promise<Result<Result<AnalysisResult, AnalysisError>, unknown>> {
    try {
      this.logRequestAttempt(attempt, base64Image);

      // Create promise race to handle timeouts
      const timeoutPromise = this.createTimeoutPromise();
      const startTime = Date.now();
      const completionPromise = this.makeOpenAIRequest(base64Image, options.viewport);
      const completion = await Promise.race([completionPromise, timeoutPromise]);
      const duration = Date.now() - startTime;

      this.logSuccessfulRequest(completion, duration);

      return Ok(this.processOpenAIResponse(completion, options.viewport));
    } catch (error) {
      this.logFailedRequest(attempt, error);
      return Err(error);
    }
  }

  /**
   * Log request attempt
   */
  private logRequestAttempt(attempt: number, base64Image: string): void {
    this.logger.debug(`Attempting OpenAI request (attempt ${attempt + 1}/${this.maxRetries + 1})`, {
      attempt: attempt + 1,
      totalAttempts: this.maxRetries + 1,
      imageBytes: Math.floor(base64Image.length * 0.75), // Approximate size in bytes
      requestTime: new Date().toISOString(),
    });
  }

  /**
   * Create timeout promise
   */
  private createTimeoutPromise(): Promise<never> {
    return new Promise<never>((_, reject) => {
      globalThis.setTimeout(() => reject(new Error("Request timeout")), this.timeout);
    });
  }

  /**
   * Log successful request
   */
  private logSuccessfulRequest(
    completion: OpenAI.Chat.Completions.ChatCompletion,
    duration: number
  ): void {
    this.logger.debug("OpenAI request successful", {
      duration: `${duration}ms`,
      model: "gpt-image-1",
      choicesLength: completion.choices.length,
      finishReason: completion.choices[0]?.finish_reason,
      promptTokens: completion.usage?.prompt_tokens,
      completionTokens: completion.usage?.completion_tokens,
      totalTokens: completion.usage?.total_tokens,
    });
  }

  /**
   * Log failed request
   */
  private logFailedRequest(attempt: number, error: unknown): void {
    const errorDetails =
      error instanceof Error
        ? {
            name: error.name,
            message: error.message,
            status: error instanceof OpenAI.APIError ? error.status : undefined,
            type: error instanceof OpenAI.APIError ? error.type : undefined,
          }
        : { error };

    this.logger.warn(
      `OpenAI request failed (attempt ${attempt + 1}/${this.maxRetries + 1})`,
      errorDetails
    );

    // For API errors, log more details
    if (error instanceof OpenAI.APIError) {
      this.logger.debug("OpenAI API error details", {
        status: error.status,
        type: error.type,
        param: error.param,
        code: error.code,
        error: error.error,
      });
    }
  }

  /**
   * Make the actual OpenAI API request
   */
  private async makeOpenAIRequest(
    base64Image: string,
    viewport: string
  ): Promise<OpenAI.Chat.Completions.ChatCompletion> {
    const systemPrompt = this.createSystemPrompt(viewport);
    this.logSystemPrompt(systemPrompt, viewport);

    const requestPayload = this.createRequestPayload(systemPrompt, base64Image);
    this.logRequestDetails(requestPayload, base64Image, systemPrompt);

    try {
      // Explicitly cast to the required OpenAI type
      const response = await this.openai.chat.completions.create({
        model: requestPayload.model,
        messages: requestPayload.messages,
        max_tokens: requestPayload.max_tokens,
        temperature: requestPayload.temperature,
      });
      return response;
    } catch (error) {
      this.logRequestError(error);
      throw error; // Re-throw for the retry logic
    }
  }

  /**
   * Log system prompt information
   */
  private logSystemPrompt(systemPrompt: string, viewport: string): void {
    this.logger.debug("Created system prompt", {
      viewport,
      promptLength: systemPrompt.length,
      promptStart: systemPrompt.slice(0, 50) + "...",
    });
  }

  /**
   * Create OpenAI request payload
   */
  private createRequestPayload(systemPrompt: string, base64Image: string): OpenAIRequestPayload {
    return {
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
    };
  }

  /**
   * Log request details
   */
  private logRequestDetails(
    requestPayload: OpenAIRequestPayload,
    base64Image: string,
    systemPrompt: string
  ): void {
    this.logger.debug("OpenAI API request details", {
      model: requestPayload.model,
      messageCount: requestPayload.messages.length,
      systemPromptLength: systemPrompt.length,
      userMessageContentCount: Array.isArray(requestPayload.messages[1].content)
        ? requestPayload.messages[1].content.length
        : 0,
      imageUrlStart: `data:image/jpeg;base64,${base64Image.slice(0, 20)}...`,
      max_tokens: requestPayload.max_tokens,
      temperature: requestPayload.temperature,
      imageSize: `${Math.round(base64Image.length / 1024)}KB`,
    });
  }

  /**
   * Log request error
   */
  private logRequestError(error: unknown): void {
    this.logger.error("Error in OpenAI API request", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
  }

  /**
   * Process API response into analysis result
   */
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

  /**
   * Handle API and other errors
   */
  private handleError(error: unknown): Result<AnalysisResult, AnalysisError> {
    if (error instanceof OpenAI.APIError) {
      return this.handleApiError(error);
    }

    if (error instanceof Error && error.name === "FetchError") {
      return this.handleNetworkError(error);
    }

    return this.handleGenericError(error);
  }

  /**
   * Handle OpenAI API errors specifically
   */
  private handleApiError(
    error: InstanceType<typeof OpenAI.APIError>
  ): Result<AnalysisResult, AnalysisError> {
    const code = this.getApiErrorCode(error.status);

    // Log detailed API error information
    this.logger.error("OpenAI API error", {
      status: error.status,
      code,
      message: error.message,
      type: error.type,
      headers: error.headers,
      body: error.error, // Log the raw error response body
      requestId: error.headers ? "x-request-id header may be present" : undefined,
    });

    // If it's a 400 error, log more details about possible request issues
    if (error.status === 400) {
      this.logger.debug("Possible 400 error causes", {
        possibleCauses: [
          "Invalid API key format",
          "Invalid model name",
          "Invalid image format or size",
          "Malformed request body",
          "Maximum context length exceeded",
        ],
      });
    }

    return Err({
      type: "API_ERROR",
      code,
      message: `OpenAI API error: ${error.message}`,
      status: error.status,
      details: JSON.stringify(error.error, null, 2),
    } as AnalysisError);
  }

  /**
   * Handle network errors
   */
  private handleNetworkError(error: Error): Result<AnalysisResult, AnalysisError> {
    this.logger.error("Network error calling OpenAI API", {
      errorName: error.name,
      message: error.message,
      stack: error.stack,
      cause: error.cause,
    });

    return Err({
      type: "NETWORK_ERROR",
      code: "CONNECTION_ERROR",
      message: `Network error while calling OpenAI API. Please check your internet connection. ${error.message}`,
    } as AnalysisError);
  }

  /**
   * Handle other types of errors
   */
  private handleGenericError(error: unknown): Result<AnalysisResult, AnalysisError> {
    this.logger.error("Vision analysis failed with unknown error", {
      errorType: error instanceof Error ? error.constructor.name : typeof error,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    return Err({
      type: "ANALYSIS_ERROR",
      code: "PROCESSING_FAILED",
      message: error instanceof Error ? error.message : "Unknown error during analysis",
    } as AnalysisError);
  }

  /**
   * Get the appropriate error code based on status
   */
  private getApiErrorCode(status: number | undefined): string {
    if (status === 429) return "RATE_LIMIT";
    if (status === 401) return "INVALID_KEY";
    if (status === 400) return "BAD_REQUEST";
    if (status === 415) return "INVALID_IMAGE";
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
