/**
 * Comprehensive error types for the design feedback CLI application
 */

/**
 * Exit codes for different error scenarios
 */
export enum ExitCode {
  SUCCESS = 0,
  GENERAL_ERROR = 1,
  CONFIGURATION_ERROR = 2,
  NETWORK_ERROR = 3,
  API_ERROR = 4,
  FILE_SYSTEM_ERROR = 5,
  INVALID_INPUT = 6,
  SCREENSHOT_ERROR = 7,
  TIMEOUT_ERROR = 8,
}

/**
 * Base error interface with user-friendly message
 */
export interface BaseError {
  message: string;
  code?: string;
  details?: unknown;
}

/**
 * Configuration-related errors
 */
export interface ConfigurationError extends BaseError {
  type: "CONFIGURATION_ERROR";
  code: "MISSING_API_KEY" | "INVALID_CONFIG_FILE" | "CONFIG_READ_ERROR";
}

/**
 * Screenshot capture errors
 */
export interface ScreenshotError extends BaseError {
  type: "SCREENSHOT_ERROR";
  code: "INVALID_URL" | "CAPTURE_FAILED" | "TOOL_NOT_FOUND" | "TIMEOUT";
}

/**
 * OpenAI API errors
 */
export interface ApiError extends BaseError {
  type: "API_ERROR";
  code: "RATE_LIMIT" | "INVALID_KEY" | "SERVER_ERROR" | "NETWORK_ERROR";
  status?: number;
}

/**
 * File system errors
 */
export interface FileSystemError extends BaseError {
  type: "FILE_SYSTEM_ERROR";
  code: "READ_ERROR" | "WRITE_ERROR" | "PERMISSION_DENIED" | "PATH_NOT_FOUND";
  path?: string;
}

/**
 * Input validation errors
 */
export interface ValidationError extends BaseError {
  type: "VALIDATION_ERROR";
  code: "INVALID_URL" | "INVALID_VIEWPORT" | "INVALID_OPTION";
  field?: string;
}

/**
 * Analysis errors
 */
export interface AnalysisError extends BaseError {
  type: "ANALYSIS_ERROR";
  code: "PROCESSING_FAILED" | "INVALID_RESPONSE" | "TIMEOUT";
}

/**
 * Union type of all application errors
 */
export type AppError =
  | ConfigurationError
  | ScreenshotError
  | ApiError
  | FileSystemError
  | ValidationError
  | AnalysisError;

/**
 * User-friendly error messages mapped by error type and code
 */
export const ErrorMessages: Record<string, Record<string, string>> = {
  CONFIGURATION_ERROR: {
    MISSING_API_KEY:
      "OpenAI API key not found. Please set OPENAI_API_KEY environment variable or run 'design-feedback config' to set it up.",
    INVALID_CONFIG_FILE:
      "Invalid configuration file format. Please check your ~/.design-feedback/config.json file.",
    CONFIG_READ_ERROR:
      "Unable to read configuration file. Please ensure you have proper permissions.",
  },
  SCREENSHOT_ERROR: {
    INVALID_URL:
      "The provided URL is invalid. Please provide a valid URL starting with http:// or https://",
    CAPTURE_FAILED:
      "Failed to capture screenshot. The website might be unreachable or the page might have failed to load.",
    TOOL_NOT_FOUND:
      "Screenshot tool not found. Please ensure @alexberriman/screenshotter is properly installed.",
    TIMEOUT: "Screenshot capture timed out. The page took too long to load.",
  },
  API_ERROR: {
    RATE_LIMIT: "OpenAI API rate limit exceeded. Please wait a moment and try again.",
    INVALID_KEY: "Invalid OpenAI API key. Please check your configuration.",
    SERVER_ERROR: "OpenAI server error. The service might be temporarily unavailable.",
    NETWORK_ERROR: "Network error while calling OpenAI API. Please check your internet connection.",
  },
  FILE_SYSTEM_ERROR: {
    READ_ERROR: "Unable to read file. Please check the file exists and you have read permissions.",
    WRITE_ERROR:
      "Unable to write file. Please check you have write permissions for the target directory.",
    PERMISSION_DENIED:
      "Permission denied. You don't have the necessary permissions for this operation.",
    PATH_NOT_FOUND: "Path not found. The specified file or directory doesn't exist.",
  },
  VALIDATION_ERROR: {
    INVALID_URL: "Invalid URL format. URLs must start with http:// or https://",
    INVALID_VIEWPORT:
      "Invalid viewport option. Use 'mobile', 'tablet', 'desktop', or custom format like '1920x1080'.",
    INVALID_OPTION: "Invalid command option. Run 'design-feedback --help' for available options.",
  },
  ANALYSIS_ERROR: {
    PROCESSING_FAILED:
      "Failed to analyze the screenshot. The AI model might be temporarily unavailable.",
    INVALID_RESPONSE: "Received invalid response from AI model. Please try again.",
    TIMEOUT: "Analysis timed out. The AI model took too long to respond.",
  },
};

/**
 * Create a user-friendly error message from an error object
 */
export function createUserFriendlyError(error: AppError): string {
  const baseMessage = ErrorMessages[error.type]?.[error.code] ?? error.message;

  // Add additional context if available
  if (error.type === "FILE_SYSTEM_ERROR" && error.path) {
    return `${baseMessage}\nFile: ${error.path}`;
  }

  if (error.type === "VALIDATION_ERROR" && error.field) {
    return `${baseMessage}\nField: ${error.field}`;
  }

  if (error.type === "API_ERROR" && error.status) {
    return `${baseMessage}\nStatus code: ${error.status}`;
  }

  return baseMessage;
}

/**
 * Get the appropriate exit code for an error
 */
export function getExitCode(error: AppError): ExitCode {
  switch (error.type) {
    case "CONFIGURATION_ERROR": {
      return ExitCode.CONFIGURATION_ERROR;
    }
    case "SCREENSHOT_ERROR": {
      return ExitCode.SCREENSHOT_ERROR;
    }
    case "API_ERROR": {
      return ExitCode.API_ERROR;
    }
    case "FILE_SYSTEM_ERROR": {
      return ExitCode.FILE_SYSTEM_ERROR;
    }
    case "VALIDATION_ERROR": {
      return ExitCode.INVALID_INPUT;
    }
    case "ANALYSIS_ERROR": {
      return error.code === "TIMEOUT" ? ExitCode.TIMEOUT_ERROR : ExitCode.GENERAL_ERROR;
    }
    default: {
      return ExitCode.GENERAL_ERROR;
    }
  }
}
