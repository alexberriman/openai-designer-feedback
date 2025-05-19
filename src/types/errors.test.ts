import { describe, it, expect } from "vitest";
import {
  createUserFriendlyError,
  getExitCode,
  ExitCode,
  ErrorMessages,
  type ConfigurationError,
  type ScreenshotError,
  type ApiError,
  type FileSystemError,
  type ValidationError,
  type AnalysisError,
} from "./errors.js";

describe("createUserFriendlyError", () => {
  it("should create user-friendly message for configuration error", () => {
    const error: ConfigurationError = {
      type: "CONFIGURATION_ERROR",
      code: "MISSING_API_KEY",
      message: "API key not found",
    };

    const result = createUserFriendlyError(error);
    expect(result).toBe(ErrorMessages.CONFIGURATION_ERROR.MISSING_API_KEY);
  });

  it("should create user-friendly message for screenshot error", () => {
    const error: ScreenshotError = {
      type: "SCREENSHOT_ERROR",
      code: "INVALID_URL",
      message: "Invalid URL",
    };

    const result = createUserFriendlyError(error);
    expect(result).toBe(ErrorMessages.SCREENSHOT_ERROR.INVALID_URL);
  });

  it("should create user-friendly message for API error with status", () => {
    const error: ApiError = {
      type: "API_ERROR",
      code: "RATE_LIMIT",
      message: "Rate limit exceeded",
      status: 429,
    };

    const result = createUserFriendlyError(error);
    expect(result).toContain(ErrorMessages.API_ERROR.RATE_LIMIT);
    expect(result).toContain("Status code: 429");
  });

  it("should create user-friendly message for file system error with path", () => {
    const error: FileSystemError = {
      type: "FILE_SYSTEM_ERROR",
      code: "READ_ERROR",
      message: "Cannot read file",
      path: "./screenshot.png",
    };

    const result = createUserFriendlyError(error);
    expect(result).toContain(ErrorMessages.FILE_SYSTEM_ERROR.READ_ERROR);
    expect(result).toContain("File: ./screenshot.png");
  });

  it("should create user-friendly message for validation error with field", () => {
    const error: ValidationError = {
      type: "VALIDATION_ERROR",
      code: "INVALID_VIEWPORT",
      message: "Invalid viewport",
      field: "viewport",
    };

    const result = createUserFriendlyError(error);
    expect(result).toContain(ErrorMessages.VALIDATION_ERROR.INVALID_VIEWPORT);
    expect(result).toContain("Field: viewport");
  });

  it("should fall back to error message if code not found", () => {
    const error: AnalysisError = {
      type: "ANALYSIS_ERROR",
      code: "PROCESSING_FAILED",
      message: "Custom error message",
    };

    // Temporarily modify to test fallback
    const originalMessage = ErrorMessages.ANALYSIS_ERROR.PROCESSING_FAILED;
    delete ErrorMessages.ANALYSIS_ERROR.PROCESSING_FAILED;

    const result = createUserFriendlyError(error);
    expect(result).toBe("Custom error message");

    // Restore original message
    ErrorMessages.ANALYSIS_ERROR.PROCESSING_FAILED = originalMessage;
  });
});

describe("getExitCode", () => {
  it("should return correct exit code for configuration error", () => {
    const error: ConfigurationError = {
      type: "CONFIGURATION_ERROR",
      code: "MISSING_API_KEY",
      message: "API key not found",
    };

    expect(getExitCode(error)).toBe(ExitCode.CONFIGURATION_ERROR);
  });

  it("should return correct exit code for screenshot error", () => {
    const error: ScreenshotError = {
      type: "SCREENSHOT_ERROR",
      code: "CAPTURE_FAILED",
      message: "Capture failed",
    };

    expect(getExitCode(error)).toBe(ExitCode.SCREENSHOT_ERROR);
  });

  it("should return correct exit code for API error", () => {
    const error: ApiError = {
      type: "API_ERROR",
      code: "RATE_LIMIT",
      message: "Rate limit",
    };

    expect(getExitCode(error)).toBe(ExitCode.API_ERROR);
  });

  it("should return correct exit code for file system error", () => {
    const error: FileSystemError = {
      type: "FILE_SYSTEM_ERROR",
      code: "WRITE_ERROR",
      message: "Write error",
    };

    expect(getExitCode(error)).toBe(ExitCode.FILE_SYSTEM_ERROR);
  });

  it("should return correct exit code for validation error", () => {
    const error: ValidationError = {
      type: "VALIDATION_ERROR",
      code: "INVALID_URL",
      message: "Invalid URL",
    };

    expect(getExitCode(error)).toBe(ExitCode.INVALID_INPUT);
  });

  it("should return timeout exit code for timeout analysis error", () => {
    const error: AnalysisError = {
      type: "ANALYSIS_ERROR",
      code: "TIMEOUT",
      message: "Timeout",
    };

    expect(getExitCode(error)).toBe(ExitCode.TIMEOUT_ERROR);
  });

  it("should return general exit code for other analysis errors", () => {
    const error: AnalysisError = {
      type: "ANALYSIS_ERROR",
      code: "PROCESSING_FAILED",
      message: "Processing failed",
    };

    expect(getExitCode(error)).toBe(ExitCode.GENERAL_ERROR);
  });
});
