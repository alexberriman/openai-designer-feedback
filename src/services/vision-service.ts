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
  isDesignRecommendation?: boolean;
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
 * Types for accessing internal OpenAI client properties
 */
interface Connection {
  close?: () => void;
}

interface Agent {
  destroy?: () => void;
}

interface Dispatcher {
  connections?: Record<string, Connection>;
  agent?: Agent;
}

interface FetchClient {
  dispatcher?: Dispatcher;
}

interface BaseClient {
  fetch?: FetchClient;
}

interface OpenAIWithClose extends OpenAI {
  close?: () => Promise<void>;
  baseClient?: BaseClient;
}

/**
 * Service for analyzing screenshots using OpenAI's gpt-image-1 vision model
 */
export class VisionService {
  private openai: OpenAI;
  private logger = getGlobalLogger();
  private maxRetries = 3;
  private retryDelay = 1000; // milliseconds
  private timeout = 60_000; // 60 seconds

  constructor(apiKey: string) {
    this.logger.debugObject("Initializing VisionService", {
      apiKeyPrefix: apiKey.slice(0, 7) + "...",
      apiKeyLength: apiKey.length,
      apiKeyType: apiKey.startsWith("sk-proj-") ? "Project API Key" : "Standard API Key",
    });

    this.openai = new OpenAI({
      apiKey,
      httpAgent: this.createHttpAgent(),
      maxRetries: this.maxRetries,
      timeout: this.timeout,
    });
  }

  /**
   * Try to close built-in client implementation if available
   */
  private async tryCloseClient(): Promise<void> {
    try {
      const client = this.openai as OpenAIWithClose;

      if (client && typeof client.close === "function") {
        await client.close();
        this.logger.debug("Successfully closed OpenAI client via close() method");
      }
    } catch (error) {
      this.logger.debug(`Error closing client: ${String(error)}`);
    }
  }

  /**
   * Try to close any connections in the fetch client
   */
  private tryCloseConnections(fetchClient: FetchClient): void {
    if (!fetchClient.dispatcher?.connections) return;

    this.logger.debug("Found connections in fetch dispatcher, closing");
    try {
      for (const conn of Object.values(fetchClient.dispatcher.connections)) {
        if (typeof conn.close === "function") {
          conn.close();
          this.logger.debug("Closed a connection");
        }
      }
    } catch (error) {
      this.logger.debug(`Error closing connections: ${String(error)}`);
    }
  }

  /**
   * Try to destroy the HTTP agent if it exists
   */
  private tryDestroyAgent(fetchClient: FetchClient): void {
    if (!fetchClient.dispatcher?.agent?.destroy) return;

    this.logger.debug("Found agent in fetch dispatcher, destroying");
    try {
      fetchClient.dispatcher.agent.destroy();
      this.logger.debug("Destroyed fetch agent");
    } catch (error) {
      this.logger.debug(`Error destroying agent: ${String(error)}`);
    }
  }

  /**
   * Try to clean up the fetch client and its resources
   */
  private tryCleanupFetchClient(): void {
    try {
      const client = this.openai as OpenAIWithClose;
      const fetchClient = client?.baseClient?.fetch;

      if (fetchClient) {
        this.logger.debug("Found OpenAI internal fetch client, attempting to clean up");

        // Try to close connections
        this.tryCloseConnections(fetchClient);

        // Try to destroy the agent
        this.tryDestroyAgent(fetchClient);
      }
    } catch (error) {
      this.logger.debug(`Failed to clean up fetch client: ${String(error)}`);
    }
  }

  /**
   * Try to force garbage collection if available
   */
  private tryForceGarbageCollection(): void {
    // Only works if Node is started with --expose-gc flag
    const nodeProcess = globalThis as unknown as { gc?: () => void };
    if (!nodeProcess.gc) return;

    try {
      nodeProcess.gc();
      this.logger.debug("Manually triggered garbage collection");
    } catch (error) {
      this.logger.debug(`Error triggering garbage collection: ${String(error)}`);
    }
  }

  /**
   * Clean up resources to allow proper process termination
   * This method handles cleaning up the OpenAI client to prevent process hanging
   * @returns Promise that resolves when cleanup is complete
   */
  public async destroy(): Promise<void> {
    try {
      this.logger.debug("Starting VisionService cleanup...");

      // Try to close client if it has a close method
      await this.tryCloseClient();

      // Try to clean up fetch client and HTTP resources
      this.tryCleanupFetchClient();

      // Force reference removal to allow garbage collection
      this.openai = null as unknown as OpenAI;

      // Try to force garbage collection
      this.tryForceGarbageCollection();

      this.logger.debug("VisionService resources cleaned up");
    } catch (error) {
      this.logger.warnObject("Error cleaning up VisionService", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
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
    this.logger.infoObject("Starting vision analysis", {
      viewport: options.viewport,
      path: options.imagePath,
      isDesignRecommendation: options.isDesignRecommendation,
    });
    this.logger.debugObject("Vision options", options);

    // Convert image to base64
    const base64Result = await this.imageToBase64(options.imagePath);
    if (base64Result.err) {
      return Err(base64Result.val);
    }

    // Call OpenAI and handle the response
    return this.callOpenAI(base64Result.val, options);
  }

  /**
   * Gets design recommendations for a screenshot
   */
  async getDesignRecommendations(
    options: VisionAnalysisOptions
  ): Promise<Result<AnalysisResult, AnalysisError>> {
    this.logger.infoObject("Starting design recommendations analysis", {
      viewport: options.viewport,
      path: options.imagePath,
    });

    // Create a copy of the options with isDesignRecommendation flag set to true
    const designOptions: VisionAnalysisOptions = {
      ...options,
      isDesignRecommendation: true,
    };

    this.logger.debugObject("Design recommendations options", designOptions);

    // Convert image to base64
    const base64Result = await this.imageToBase64(options.imagePath);
    if (base64Result.err) {
      return Err(base64Result.val);
    }

    // Call OpenAI and handle the response with design prompt
    return this.callOpenAI(base64Result.val, designOptions);
  }

  /**
   * Main method to call OpenAI API with built-in retry logic
   */
  /**
   * Get the API key type description based on the key format
   */
  private getApiKeyType(apiKey: string): string {
    if (apiKey.startsWith("sk-proj-")) {
      return "Project-scoped key";
    }
    if (apiKey.startsWith("sk-")) {
      return "Regular API key";
    }
    return "Unknown format";
  }

  /**
   * Get the root cause for an API error based on status code
   */
  private getRootCause(error: InstanceType<typeof OpenAI.APIError>): string | undefined {
    if (error.status === 401) {
      return "Project-scoped key may not have access to vision models";
    }
    if (error.status === 404) {
      return "Model may not exist or is not available to your account";
    }
    return undefined;
  }

  /**
   * Log error details for debugging purposes
   */
  private logErrorDetails(attempt: number, error: unknown): void {
    this.logger.debugObject(`Error details (attempt ${attempt + 1}/${this.maxRetries + 1})`, {
      errorType: error instanceof Error ? error.constructor.name : typeof error,
      errorMessage: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      apiError:
        error instanceof OpenAI.APIError
          ? {
              status: error.status,
              type: error.type,
              code: error.code,
              headers: error.headers,
              error: error.error,
              rootCause: this.getRootCause(error),
            }
          : undefined,
    });
  }

  private async callOpenAI(
    base64Image: string,
    options: VisionAnalysisOptions
  ): Promise<Result<AnalysisResult, AnalysisError>> {
    this.logger.debugObject("API call debug info", {
      apiKeyFormat: `${options.apiKey.slice(0, 7)}... (${options.apiKey.length} chars)`,
      apiKeyType: this.getApiKeyType(options.apiKey),
      model: "gpt-4-vision-preview",
      imageSize: `${Math.round(base64Image.length / 1024)}KB`,
      isDesignRecommendation: options.isDesignRecommendation,
    });

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

      // Log error details at debug level
      this.logErrorDetails(attempt, lastError);

      // Also log with our enhanced debugObject method to ensure visibility
      if (lastError instanceof Error) {
        this.logger.debugObject(
          `Enhanced error details (attempt ${attempt + 1}/${this.maxRetries + 1})`,
          {
            errorType: lastError.constructor.name,
            errorMessage: lastError.message,
            stack: lastError.stack,
            apiErrorDetails:
              lastError instanceof OpenAI.APIError
                ? {
                    status: lastError.status,
                    type: lastError.type,
                    code: lastError.code,
                  }
                : undefined,
          }
        );
      }

      // Handle certain errors that should not be retried
      if (this.shouldNotRetry(lastError)) {
        this.logger.info("Error should not be retried.");
        return this.handleError(lastError);
      }
    }

    // All retries exhausted
    this.logger.errorObject("All retry attempts exhausted", {
      attempts: this.maxRetries + 1,
    });
    return this.handleError(lastError);
  }

  /**
   * Log the start of an API call sequence
   */
  private logApiCallStart(base64Image: string, options: VisionAnalysisOptions): void {
    this.logger.debugObject("Starting OpenAI API call sequence", {
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
      const completionPromise = this.makeOpenAIRequest(base64Image, options);
      const completion = await Promise.race([completionPromise, timeoutPromise]);
      const duration = Date.now() - startTime;

      this.logSuccessfulRequest(completion, duration);

      return Ok(
        this.processOpenAIResponse(completion, options.viewport, options.isDesignRecommendation)
      );
    } catch (error) {
      this.logFailedRequest(attempt, error);
      return Err(error);
    }
  }

  /**
   * Log request attempt
   */
  private logRequestAttempt(attempt: number, base64Image: string): void {
    this.logger.debugObject(
      `Attempting OpenAI request (attempt ${attempt + 1}/${this.maxRetries + 1})`,
      {
        attempt: attempt + 1,
        totalAttempts: this.maxRetries + 1,
        imageBytes: Math.floor(base64Image.length * 0.75), // Approximate size in bytes
        requestTime: new Date().toISOString(),
      }
    );
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
    this.logger.debugObject("OpenAI request successful", {
      duration: `${duration}ms`,
      model: "gpt-image-1",
      choicesLength: completion.choices.length,
      finishReason: completion.choices[0]?.finish_reason,
      promptTokens: completion.usage?.prompt_tokens,
      completionTokens: completion.usage?.completion_tokens,
      totalTokens: completion.usage?.total_tokens,
    });

    // Log the raw OpenAI response in debug mode
    this.logger.debugObject("Raw OpenAI response", completion);
  }

  /**
   * Log failed request
   */
  /**
   * Categorize an error for better logging
   */
  private categorizeError(error: unknown): string {
    if (error instanceof OpenAI.APIError) {
      return "OpenAI API Error";
    }

    if (error instanceof Error) {
      if (error.message.includes("timeout") || error.message === "Request timeout") {
        return "Timeout Error";
      }
      if (error.name === "FetchError") {
        return "Network Error";
      }
      return "General Error";
    }

    return "Unknown Error";
  }

  /**
   * Create error details structure for logging
   */
  private createErrorDetails(error: unknown, errorCategory: string): Record<string, unknown> {
    if (error instanceof Error) {
      return {
        category: errorCategory,
        name: error.name,
        message: error.message,
        status: error instanceof OpenAI.APIError ? error.status : undefined,
        type: error instanceof OpenAI.APIError ? error.type : undefined,
        isTimeout: error.message === "Request timeout" || error.message.includes("timeout"),
      };
    }

    return { error, category: errorCategory };
  }

  /**
   * Log API error details
   */
  private logApiErrorDetails(error: InstanceType<typeof OpenAI.APIError>): void {
    this.logger.debugObject("OpenAI API error details", {
      status: error.status,
      type: error.type,
      param: error.param,
      code: error.code,
      error: error.error,
      requestId: error.headers?.["x-request-id"] || null,
      rateLimit: error.headers?.["x-ratelimit-limit"] || null,
      rateLimitRemaining: error.headers?.["x-ratelimit-remaining"] || null,
      retryAfter: error.headers?.["retry-after"] || null,
    });
  }

  /**
   * Log timeout error details
   */
  private logTimeoutErrorDetails(error: Error, attempt: number): void {
    const nextRetryDelay =
      attempt < this.maxRetries ? `${this.retryDelay * Math.pow(2, attempt)}ms` : "No more retries";

    this.logger.debugObject("Request timeout details", {
      timeoutValue: `${this.timeout}ms`,
      errorName: error.name,
      errorStack: error.stack,
      retryCount: attempt,
      nextRetryDelay,
      suggestions: [
        "Consider increasing the timeout value",
        "Check if the image size is too large",
        "Verify network stability and latency",
      ],
    });
  }

  /**
   * Log general error details
   */
  private logGeneralErrorDetails(error: Error, attempt: number): void {
    this.logger.debugObject("Request error details", {
      errorName: error.name,
      errorMessage: error.message,
      errorStack: error.stack,
      errorCause: error.cause,
      attemptNumber: attempt + 1,
      maxAttempts: this.maxRetries + 1,
    });
  }

  /**
   * Log detailed error information based on error type
   */
  private logDetailedErrorInfo(attempt: number, error: unknown): void {
    if (error instanceof OpenAI.APIError) {
      this.logApiErrorDetails(error);
    } else if (error instanceof Error && error.message === "Request timeout") {
      this.logTimeoutErrorDetails(error, attempt);
    } else if (error instanceof Error) {
      this.logGeneralErrorDetails(error, attempt);
    }
  }

  private logFailedRequest(attempt: number, error: unknown): void {
    const errorCategory = this.categorizeError(error);

    // Basic warning log with essential information
    const errorDetails = this.createErrorDetails(error, errorCategory);

    this.logger.warnObject(
      `OpenAI request failed (attempt ${attempt + 1}/${this.maxRetries + 1})`,
      errorDetails
    );

    this.logDetailedErrorInfo(attempt, error);
  }

  /**
   * Make the actual OpenAI API request
   */
  /**
   * Get likely cause of error based on error type and status
   */
  private getLikelyCause(error: unknown): string | undefined {
    if (!(error instanceof OpenAI.APIError)) {
      return undefined;
    }

    if (error.status === 401) {
      return "Project-scoped API key doesn't have access to vision models";
    }

    if (error.status === 404) {
      return "The requested model doesn't exist or isn't available";
    }

    return undefined;
  }

  /**
   * Get recommended solution based on error type
   */
  private getSolutionForError(error: unknown): string | undefined {
    if (!(error instanceof OpenAI.APIError)) {
      return undefined;
    }

    if (error.status === 401) {
      return "Use a standard OpenAI API key (sk-...) instead";
    }

    if (error.status === 404) {
      return "Try a different model like gpt-4-vision-preview";
    }

    return undefined;
  }

  /**
   * Log API configuration details
   */
  private logApiConfiguration(model: string): void {
    const apiKeyPrefix = this.openai.apiKey ? this.openai.apiKey.slice(0, 7) + "..." : "undefined";
    const apiKeyLength = this.openai.apiKey ? this.openai.apiKey.length : 0;
    const apiKeyType = this.openai.apiKey ? this.getApiKeyType(this.openai.apiKey) : "Unknown";

    this.logger.debugObject("OpenAI API configuration", {
      apiKeyPrefix,
      apiKeyLength,
      apiKeyType,
      model,
    });
  }

  /**
   * Execute OpenAI API request
   */
  private async executeApiRequest(
    requestPayload: OpenAIRequestPayload
  ): Promise<OpenAI.Chat.Completions.ChatCompletion> {
    this.logger.debug("Using standard chat.completions API with gpt-4.1 model");

    if (!requestPayload.messages) {
      throw new Error("Invalid request payload: messages array is missing");
    }

    this.logger.debug(`Making request to model: ${requestPayload.model}`);

    try {
      const response = await this.openai.chat.completions.create({
        model: requestPayload.model,
        messages: requestPayload.messages,
        max_tokens: requestPayload.max_tokens,
        temperature: requestPayload.temperature,
      });

      this.logger.debug("OpenAI API request successful!");
      return response;
    } catch (innerError) {
      this.logApiCallError(innerError);
      throw innerError;
    }
  }

  /**
   * Log API call error information
   */
  private logApiCallError(error: unknown): void {
    this.logger.debugObject("Error during OpenAI API call", {
      status: error instanceof OpenAI.APIError ? error.status : undefined,
      type: error instanceof OpenAI.APIError ? error.type : undefined,
      message: error instanceof Error ? error.message : String(error),
      error: error instanceof OpenAI.APIError ? error.error : error,
    });
  }

  /**
   * Log failure debug information
   */
  private logFailureDebugInfo(error: unknown): void {
    const errorInfo = {
      errorType: error instanceof Error ? error.constructor.name : typeof error,
      errorMessage: error instanceof Error ? error.message : String(error),
      status: error instanceof OpenAI.APIError ? error.status : undefined,
      type: error instanceof OpenAI.APIError ? error.type : undefined,
      errorResponse: error instanceof OpenAI.APIError ? error.error : undefined,
      likelyCause: this.getLikelyCause(error),
      solution: this.getSolutionForError(error),
    };

    this.logger.debugObject("OpenAI request failed", errorInfo);
  }

  /**
   * Make OpenAI API request with error handling
   */
  private async makeOpenAIRequest(
    base64Image: string,
    options: VisionAnalysisOptions
  ): Promise<OpenAI.Chat.Completions.ChatCompletion> {
    const systemPrompt = this.createSystemPrompt(options.viewport, options.isDesignRecommendation);
    this.logger.debugObject("System prompt info", {
      systemPrompt,
      viewport: options.viewport,
      isDesignRecommendation: options.isDesignRecommendation,
    });
    this.logSystemPrompt(systemPrompt, options.viewport);

    const requestPayload = this.createRequestPayload(
      systemPrompt,
      base64Image,
      options.isDesignRecommendation
    );
    this.logRequestDetails(requestPayload, base64Image, systemPrompt);

    this.logApiConfiguration(requestPayload.model);

    try {
      return await this.executeApiRequest(requestPayload);
    } catch (error) {
      this.logRequestError(error);
      this.logFailureDebugInfo(error);
      throw error; // Re-throw for the retry logic
    }
  }

  /**
   * Log system prompt information
   */
  private logSystemPrompt(systemPrompt: string, viewport: string): void {
    this.logger.debugObject("Created system prompt", {
      viewport,
      promptLength: systemPrompt.length,
      promptStart: systemPrompt.slice(0, 50) + "...",
      fullPrompt: systemPrompt, // Log the entire system prompt for debugging
    });
  }

  private createRequestPayload(
    systemPrompt: string,
    base64Image: string,
    isDesignRecommendation: boolean = false
  ): OpenAIRequestPayload {
    this.logger.debugObject("OpenAI model check", {
      previousModel: "gpt-image-1",
      usingModel: "gpt-4.1",
      note: "Using widely available model that works with most API keys",
      isDesignRecommendation,
    });

    const userPrompt = isDesignRecommendation
      ? "Analyze this website screenshot and provide professional design recommendations to make it visually stunning and modern."
      : "Please analyze this website screenshot and identify only clear, visual layout issues.";

    // We'll increase the token limit for design recommendations as they're more extensive
    // But we need to be careful not to exceed the maximum context length
    const maxTokens = isDesignRecommendation ? 1536 : 512;

    // Use higher temperature for design recommendations to encourage creative suggestions
    // But keep it moderate to ensure structured response
    const temperature = isDesignRecommendation ? 0.4 : 0;

    return {
      model: "gpt-4.1",
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
              text: userPrompt,
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
      max_tokens: maxTokens,
      temperature: temperature,
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
    this.logger.debugObject("OpenAI API request details", {
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
      fullRequestStructure: JSON.stringify(
        {
          model: requestPayload.model,
          messages: requestPayload.messages.map((msg) => ({
            role: msg.role,
            content: msg.role === "system" ? msg.content : "[Content omitted for brevity]",
          })),
          max_tokens: requestPayload.max_tokens,
          temperature: requestPayload.temperature,
        },
        null,
        2
      ),
    });
  }

  /**
   * Log request error
   */
  /**
   * Build context object for API error debugging
   */
  private buildApiErrorContext(
    error: InstanceType<typeof OpenAI.APIError>
  ): Record<string, unknown> {
    const context: Record<string, unknown> = {
      apiErrorType: error.type,
      status: error.status,
      headers: error.headers,
      requestId: error.headers?.["x-request-id"] || null,
      code: error.code,
      param: error.param,
      errorResponse: error.error,
    };

    // Add full error response JSON
    if (error.error) {
      try {
        context.fullErrorResponseJson = JSON.stringify(error.error, null, 2);
      } catch {
        context.fullErrorResponseJson = "[Error converting error response to JSON]";
      }
    }

    // Add specific status code information
    switch (error.status) {
      case 401: {
        context.authenticationNotes = `API key appears to be invalid or unauthorized. Status code: ${error.status}`;
        context.apiKeyPrefix = this.openai.apiKey
          ? this.openai.apiKey.slice(0, 7) + "..."
          : "undefined";

        break;
      }
      case 404: {
        context.modelNotes = "Model may not exist or is not available to your account";

        break;
      }
      case 400: {
        context.badRequestDetails = "Check image format, size, and API request structure";

        break;
      }
      // No default
    }

    return context;
  }

  /**
   * Build context object for network error debugging
   */
  private buildNetworkErrorContext(error: Error): Record<string, unknown> {
    return {
      cause: error.cause,
      isFetchTimeout: error.message.includes("timeout"),
      isFetchDNSError: error.message.includes("ENOTFOUND"),
      isFetchConnectionRefused: error.message.includes("ECONNREFUSED"),
    };
  }

  /**
   * Build debug context for error logging
   */
  private buildDebugContext(error: unknown): Record<string, unknown> {
    const baseContext = {
      stack: error instanceof Error ? error.stack : undefined,
      time: new Date().toISOString(),
      nodeEnv: process.env.NODE_ENV,
    };

    if (error instanceof OpenAI.APIError) {
      return {
        ...baseContext,
        ...this.buildApiErrorContext(error),
      };
    }

    if (error instanceof Error && error.name === "FetchError") {
      return {
        ...baseContext,
        ...this.buildNetworkErrorContext(error),
      };
    }

    return baseContext;
  }

  /**
   * Log error details for API request errors
   */
  private logRequestError(error: unknown): void {
    // Basic error log at error level
    this.logger.errorObject("Error in OpenAI API request", {
      error: error instanceof Error ? error.message : String(error),
      type: error instanceof Error ? error.constructor.name : typeof error,
      isApiError: error instanceof OpenAI.APIError,
      statusCode: error instanceof OpenAI.APIError ? error.status : undefined,
    });

    const debugContext = this.buildDebugContext(error);
    this.logger.debugObject("Detailed OpenAI API request error", debugContext);
  }

  /**
   * Process API response into analysis result
   */
  private processOpenAIResponse(
    completion: OpenAI.Chat.Completions.ChatCompletion,
    viewport: string,
    isDesignRecommendation: boolean = false
  ): Result<AnalysisResult, AnalysisError> {
    const analysis = completion.choices[0]?.message?.content;
    this.logger.debugObject("Received response from OpenAI", {
      hasContent: !!analysis,
      model: completion.model,
      finishReason: completion.choices[0]?.finish_reason,
      promptTokens: completion.usage?.prompt_tokens,
      completionTokens: completion.usage?.completion_tokens,
      isDesignRecommendation,
    });

    this.logger.debugObject("OpenAI API response success", {
      model: completion.model,
      contentPreview: analysis?.slice(0, 100) + "...",
      apiStatus: "API key works with specified model",
    });

    // Log the complete raw response for debugging purposes
    this.logger.debugObject("Full OpenAI response content", completion);

    if (!analysis) {
      this.logger.error("No analysis content received from OpenAI");
      return Err({
        type: "ANALYSIS_ERROR",
        code: "INVALID_RESPONSE",
        message: "No analysis content received from OpenAI",
      } as AnalysisError);
    }

    if (isDesignRecommendation) {
      this.logger.info("Design recommendations completed successfully");

      // If design recommendations, validate if it's JSON
      let formattedRecommendations = analysis;

      // Clean the response: sometimes LLM includes markdown code blocks around JSON
      if (analysis.includes("```json")) {
        // Replace all occurrences of markdown code block syntax
        formattedRecommendations = analysis.replaceAll("```json", "").replaceAll("```", "").trim();
        this.logger.debug("Extracted JSON from markdown code block");
      } else if (analysis.includes("```")) {
        // Replace all occurrences of generic code block syntax
        formattedRecommendations = analysis.replaceAll("```", "").trim();
        this.logger.debug("Extracted content from generic code block");
      }

      // Debugging the processed recommendations
      this.logger.debugObject("Processed design recommendations", {
        originalLength: analysis.length,
        processedLength: formattedRecommendations.length,
        startsWithBracket: formattedRecommendations.trim().startsWith("["),
        endsWithBracket: formattedRecommendations.trim().endsWith("]"),
        preview: formattedRecommendations.slice(0, 100) + "...",
      });

      return Ok({
        content: "", // The main content field will remain empty for design recommendations
        designRecommendations: formattedRecommendations, // Store processed design recommendations
        timestamp: new Date().toISOString(),
        viewport,
        model: completion.model || "gpt-3.5-turbo",
      });
    }

    this.logger.info("Vision analysis completed successfully");

    return Ok({
      content: analysis,
      timestamp: new Date().toISOString(),
      viewport,
      model: completion.model || "gpt-3.5-turbo",
    });
  }

  /**
   * Creates a system prompt based on the requested analysis type
   */
  private createSystemPrompt(viewport: string, isDesignRecommendation: boolean = false): string {
    if (isDesignRecommendation) {
      return `You are a world-class product and UI designer known for creating clean, modern, layout-strong web interfaces for high-performing websites. You specialize in refining pages that already use modern frameworks like Tailwind CSS and need structural layout improvements and visual polish, not a redesign.

Viewport: ${viewport}

You are reviewing a static screenshot of a webpage. Your task is to suggest 9 specific, actionable visual improvements for this exact layout — not generic ideas, and not things that cannot be inferred from a screenshot (like animations or interactivity).

Focus on:

1. LAYOUT & STRUCTURE (high priority)
   - Fix section spacing, hierarchy, alignment, flow
   - Improve visual rhythm and reduce clutter
   - Ensure clear separation between sections and elements

2. DESIGN ENHANCEMENTS (medium priority)
   - Add tasteful visual touches that increase visual interest
   - Improve media placement, component balance, or use of whitespace
   - Add visual structure or polish using borders, backgrounds, cards

3. AESTHETIC FINESSE (low priority)
   - Tweak colors, depth, or shadowing — only if visibly relevant
   - Refine contrast or typography sparingly, assuming Tailwind handles most of it

🚫 DO NOT:
- Recommend implementing grids, dark mode, Tailwind, or framework-specific systems
- Suggest animations, micro-interactions, or loading states (it's a static screenshot)
- Provide generic advice not grounded in the actual visible layout
- Recommend copy changes, accessibility, or performance improvements

✅ DO:
- Point to specific sections or elements that visually stand out (or don't)
- Tailor your advice to what’s actually on the screen
- Be precise, visual, and layout-aware

Output a JSON array of exactly 9 recommendations, each with:

- title (string, max 50 characters)
- description (string, max 200 characters)
- priority ("high", "medium", or "low")

Example format:
[
  {
    "title": "Add Spacing Between CTA and Footer",
    "description": "The call-to-action sits too close to the footer. Increase vertical margin to give it more emphasis and breathing room.",
    "priority": "high"
  }
]

Your job is to elevate this page from decent to excellent by applying structural, visual design thinking. Focus on refinement, not reinvention.`;
    }

    return `You are a strict visual QA tester reviewing website screenshots. Your only task is to detect obvious visual layout issues in the screenshot. You are not performing an accessibility review, usability audit, or subjective design critique.

Viewport: ${viewport}

⚠️ ONLY report structural layout problems that are clearly visible in the image. Examples include:

- Navigation links overlapping the logo or each other
- Buttons with no padding or margin (text touching edges)
- Groups of logos/icons overlapping each other (e.g. company logos stacked without spacing)
- Inline links or elements with no spacing (e.g. "Privacy PolicyTerms of Service" appearing as a single blob)
- Text or sections that appear cut off, misaligned, or off-center
- Clearly broken visual stacking or layering

❌ DO NOT report on:
- Color contrast, font sizes, or typographic opinions
- Accessibility (alt tags, keyboard focus, etc.)
- Lack of sticky nav or general UX recommendations
- "Visual hierarchy" or aesthetic judgments

🧠 Think like a front-end engineer reviewing a rendering bug. If the page looks visually correct, just say:

> No critical layout or visual issues found in this screenshot.

Be concise. Only list visual bugs that are clearly broken in the image.`;
  }

  /**
   * Converts an image file to base64 string
   */
  private async imageToBase64(imagePath: string): Promise<Result<string, AnalysisError>> {
    try {
      this.logger.debugObject("Reading image file", { imagePath });
      const imageBuffer = await readFile(imagePath);
      const base64String = imageBuffer.toString("base64");
      this.logger.debugObject("Image converted to base64", { length: base64String.length });
      return Ok(base64String);
    } catch (error) {
      this.logger.errorObject("Failed to convert image to base64", { error, imagePath });
      return Err({
        type: "FILE_SYSTEM_ERROR",
        code: "READ_ERROR",
        message: `Failed to read image file: ${error instanceof Error ? error.message : "Unknown error"}`,
        path: imagePath,
      } as AnalysisError);
    }
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

    // Extract important headers for debugging
    let requestId = null;
    let rateLimit = null;
    let rateLimitRemaining = null;
    let retryAfter = null;

    if (error.headers) {
      requestId = error.headers["x-request-id"] || error.headers["x-amzn-requestid"] || null;
      rateLimit = error.headers["x-ratelimit-limit"] || null;
      rateLimitRemaining = error.headers["x-ratelimit-remaining"] || null;
      retryAfter = error.headers["retry-after"] || null;
    }

    // Log detailed API error information
    this.logger.errorObject("OpenAI API error", {
      status: error.status,
      code,
      message: error.message,
      type: error.type,
      requestId,
      rateLimit,
      rateLimitRemaining,
      retryAfter,
      errorType: error.constructor?.name,
      errorObject: typeof error,
    });

    // Log the full error object and stack at debug level
    this.logger.debugObject("OpenAI API error details", {
      stack: error.stack,
      headers: error.headers,
      body: error.error, // Log the raw error response body
      params: error.param, // Parameter that caused the error, if available
      name: error.name, // Error name
      code: error.code, // Error code from OpenAI
    });

    // Add specific debugging suggestions based on status code
    switch (error.status) {
      case 400: {
        this.logger.debugObject("Possible 400 error causes", {
          possibleCauses: [
            "Invalid API key format",
            "Invalid model name",
            "Invalid image format or size",
            "Malformed request body",
            "Maximum context length exceeded",
          ],
          suggestions: [
            "Check API key format",
            "Verify model name is 'gpt-image-1'",
            "Reduce image size/quality if image is too large",
            "Check for malformed JSON in request",
          ],
        });

        break;
      }
      case 401: {
        this.logger.debugObject("API key authentication error", {
          suggestions: [
            "Verify the API key is correct and not expired",
            "Check if the API key has proper permissions",
            "Test the key with a simple API call using curl",
            "Regenerate the API key in the OpenAI dashboard",
          ],
        });

        break;
      }
      case 429: {
        this.logger.debugObject("Rate limit exceeded error", {
          retryAfter,
          suggestions: [
            "Wait before making additional requests",
            "Check your OpenAI usage dashboard for limits",
            "Consider implementing stricter rate limiting",
            "Check if you have billing set up properly",
          ],
        });

        break;
      }
      default: {
        if (error.status && error.status >= 500) {
          this.logger.debugObject("OpenAI server error", {
            suggestions: [
              "This is an OpenAI service issue, not your code",
              "Wait and retry the request later",
              "Check OpenAI status page for service disruptions",
            ],
          });
        }
      }
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
    // Determine error code for more specific debugging
    let errorCode = "CONNECTION_ERROR";
    let suggestions: string[] = [
      "Check your internet connection",
      "Verify firewall settings are not blocking API requests",
      "Check if OpenAI API is accessible from your network",
    ];

    // Extract more specific error information based on error message patterns
    if (error.message.includes("timeout")) {
      errorCode = "TIMEOUT";
      suggestions = [
        "Increase the timeout value for API requests",
        "Check for network congestion or slow connection",
        "Reduce the size of the image being sent",
      ];
    } else if (error.message.includes("ENOTFOUND") || error.message.includes("getaddrinfo")) {
      errorCode = "DNS_ERROR";
      suggestions = [
        "Check DNS configuration",
        "Verify the API endpoint URL is correct",
        "Try using a different DNS server",
      ];
    } else if (error.message.includes("ECONNREFUSED")) {
      errorCode = "CONNECTION_REFUSED";
      suggestions = [
        "Check if the API endpoint is correct",
        "Verify the server is accepting connections",
        "Check if a proxy is needed for your network",
      ];
    } else if (error.message.includes("certificate") || error.message.includes("SSL")) {
      errorCode = "SSL_ERROR";
      suggestions = [
        "Check SSL certificate configuration",
        "Verify system time is correct (certificate validation depends on it)",
        "Update SSL certificates or libraries",
      ];
    }

    // Log basic error info at error level
    this.logger.errorObject("Network error calling OpenAI API", {
      errorName: error.name,
      message: error.message,
      code: errorCode,
    });

    // Log detailed debugging information at debug level
    this.logger.debugObject("Network error details", {
      stack: error.stack,
      cause: error.cause,
      errorType: error.constructor?.name,
      errorProperties: Object.keys(error),
      suggestions,
      troubleshootingSteps: [
        "Try a simple curl request to api.openai.com to test connectivity",
        "Check system proxy settings and environment variables",
        "Try with a different network connection if possible",
        "Look for any SSL/TLS issues in the error message",
        "Verify no network middleware is intercepting requests",
      ],
    });

    return Err({
      type: "NETWORK_ERROR",
      code: errorCode,
      message: `Network error while calling OpenAI API. Please check your internet connection. ${error.message}`,
    } as AnalysisError);
  }

  /**
   * Handle other types of errors
   */
  /**
   * Format error message for analysis errors
   */
  private formatErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return `Analysis processing failed: ${error.message}`;
    }
    return "Unknown error during analysis";
  }

  /**
   * Get standard troubleshooting steps for API errors
   */
  private getTroubleshootingSteps(): string[] {
    return [
      "Check OpenAI API status page for service disruptions",
      "Verify API key has proper permissions",
      "Check if the image format and size are supported (must be <20MB)",
      "Try with a different, smaller image",
      "Examine network traffic using a tool like Wireshark or browser dev tools",
      "Try the same request using curl or Postman to isolate the issue",
    ];
  }

  /**
   * Collect Error object information for debugging
   */
  private collectErrorObjectInfo(error: Error): Record<string, unknown> {
    // Create a type with optional properties for type safety
    interface ErrorWithExtras {
      code?: string;
      statusCode?: number;
      response?: {
        status?: number;
        statusText?: string;
        headers?: Record<string, string>;
        data?: unknown;
      };
    }

    const errorWithExtras = error as Error & ErrorWithExtras;
    const info: Record<string, unknown> = {
      name: error.name,
      cause: error.cause,
    };

    if ("code" in error) {
      info.code = errorWithExtras.code;
    }

    if ("statusCode" in error) {
      info.statusCode = errorWithExtras.statusCode;
    }

    if ("response" in error && errorWithExtras.response) {
      info.response = {
        status: errorWithExtras.response.status,
        statusText: errorWithExtras.response.statusText,
        headers: errorWithExtras.response.headers,
        data: errorWithExtras.response.data,
      };
    }

    return info;
  }

  /**
   * Collect information from non-Error objects
   */
  private collectNonErrorObjectInfo(obj: object): Record<string, unknown> {
    interface ObjectWithProps {
      status?: number;
      statusText?: string;
      message?: string;
    }

    const objWithProps = obj as ObjectWithProps;
    const info: Record<string, unknown> = {
      jsonRepresentation: JSON.stringify(obj, null, 2),
    };

    if ("status" in obj) {
      info.status = objWithProps.status;
    }

    if ("statusText" in obj) {
      info.statusText = objWithProps.statusText;
    }

    if ("message" in obj) {
      info.objectMessage = objWithProps.message;
    }

    return info;
  }

  /**
   * Collect debug information for error handling
   */
  private collectDebugInfo(error: unknown): Record<string, unknown> {
    const baseInfo = {
      stack: error instanceof Error ? error.stack : undefined,
      errorInstance: error instanceof Error ? "Error object" : "Non-Error object",
      objectType: typeof error,
      objectProperties: error ? Object.getOwnPropertyNames(error) : [],
    };

    let extraInfo = {};

    if (error instanceof Error) {
      extraInfo = this.collectErrorObjectInfo(error);
    } else if (error !== null && typeof error === "object") {
      extraInfo = this.collectNonErrorObjectInfo(error);
    }

    return {
      ...baseInfo,
      ...extraInfo,
      genericTroubleshootingSteps: this.getTroubleshootingSteps(),
    };
  }

  /**
   * Handle non-specific errors
   */
  private handleGenericError(error: unknown): Result<AnalysisResult, AnalysisError> {
    // Basic error information at error level
    this.logger.errorObject("Vision analysis failed with unknown error", {
      errorType: error instanceof Error ? error.constructor.name : typeof error,
      message: error instanceof Error ? error.message : String(error),
    });

    const debugInfo = this.collectDebugInfo(error);
    this.logger.debugObject("Unknown error details", debugInfo);

    return Err({
      type: "ANALYSIS_ERROR",
      code: "PROCESSING_FAILED",
      message: this.formatErrorMessage(error),
      details: error instanceof Error ? error.stack : String(error),
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
}
