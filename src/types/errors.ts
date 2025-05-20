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
  code: "INVALID_URL" | "CAPTURE_FAILED" | "TOOL_NOT_FOUND" | "TIMEOUT" | "READ_ERROR";
}

/**
 * OpenAI API errors
 */
export interface ApiError extends BaseError {
  type: "API_ERROR";
  code:
    | "RATE_LIMIT"
    | "INVALID_KEY"
    | "SERVER_ERROR"
    | "NETWORK_ERROR"
    | "INVALID_IMAGE"
    | "BAD_REQUEST";
  status?: number;
  details?: string;
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
  code: "PROCESSING_FAILED" | "INVALID_RESPONSE" | "TIMEOUT" | "DESIGN_RECOMMENDATIONS_FAILED";
}

/**
 * Network errors
 */
export interface NetworkError extends BaseError {
  type: "NETWORK_ERROR";
  code: "CONNECTION_ERROR" | "DNS_ERROR" | "TIMEOUT" | "SSL_ERROR" | "PROXY_ERROR";
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
  | AnalysisError
  | NetworkError;

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
    INVALID_KEY:
      "Invalid OpenAI API key. Please check your configuration and ensure the key format is correct.",
    SERVER_ERROR: "OpenAI server error. The service might be temporarily unavailable.",
    NETWORK_ERROR: "Network error while calling OpenAI API. Please check your internet connection.",
    INVALID_IMAGE:
      "The image could not be processed by the OpenAI API. It may be too large, in an unsupported format, or corrupted.",
    BAD_REQUEST:
      "The request to OpenAI was invalid. Please check the command-line parameters and try again.",
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
    DESIGN_RECOMMENDATIONS_FAILED:
      "Failed to generate design recommendations. The base analysis is still available.",
  },
  NETWORK_ERROR: {
    CONNECTION_ERROR:
      "Failed to connect to the remote server. Please check your internet connection.",
    DNS_ERROR: "Failed to resolve the domain name. Please check the URL and your DNS settings.",
    TIMEOUT: "The network request timed out. The server took too long to respond.",
    SSL_ERROR: "SSL/TLS error. Could not establish a secure connection.",
    PROXY_ERROR: "Error connecting through proxy. Please check your proxy configuration.",
  },
};

// Utility for formatting error messages
const formatAdditionalDetails = (
  error: AppError,
  type: string,
  field: string,
  formatter: (value: string) => string
): string | null => {
  if (error.type === type && error[field as keyof AppError]) {
    const value = error[field as keyof AppError];
    if (value) {
      return formatter(String(value));
    }
  }
  return null;
};

// Extract and format details string
const formatDetails = (details: unknown, maxLength = 300): string | null => {
  if (details && typeof details === "string") {
    return details.length > maxLength ? `${details.slice(0, Math.max(0, maxLength))}...` : details;
  }
  return null;
};

/**
 * Create a user-friendly error message from an error object
 */
export function createUserFriendlyError(error: AppError): string {
  // Base message from error type/code mappings or raw message
  const baseMessage = ErrorMessages[error.type]?.[error.code as string] ?? error.message;
  const parts = [baseMessage];

  // Add file path for file system errors
  const filePathInfo = formatAdditionalDetails(
    error,
    "FILE_SYSTEM_ERROR",
    "path",
    (path) => `File: ${path}`
  );
  if (filePathInfo) parts.push(filePathInfo);

  // Add field info for validation errors
  const fieldInfo = formatAdditionalDetails(
    error,
    "VALIDATION_ERROR",
    "field",
    (field) => `Field: ${field}`
  );
  if (fieldInfo) parts.push(fieldInfo);

  // Add status code for API errors
  if (error.type === "API_ERROR" && error.status) {
    parts.push(`Status code: ${error.status}`);
  }

  // Add network error type info
  if (error.type === "NETWORK_ERROR" && error.code) {
    parts.push(`Error type: ${error.code}`);
  }

  // Add error details if present
  if (error.details && typeof error.details === "string") {
    const detailsText = formatDetails(error.details);
    if (detailsText) parts.push(`Details: ${detailsText}`);
  }

  return parts.join("\n");
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
    case "NETWORK_ERROR": {
      return ExitCode.NETWORK_ERROR;
    }
    default: {
      return ExitCode.GENERAL_ERROR;
    }
  }
}
