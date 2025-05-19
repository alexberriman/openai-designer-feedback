import { describe, it, expect, vi, beforeEach } from "vitest";
import tsResults from "ts-results";
const { Ok, Err } = tsResults;
import { validateConfig } from "./validator.js";
import * as configLoader from "./config-loader.js";
import * as prompt from "../utils/prompt.js";
import type { ConfigurationError } from "../types/errors.js";

vi.mock("./config-loader.js");
vi.mock("../utils/prompt.js");

describe("validateConfig", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  it("should return config when loadConfig succeeds", async () => {
    const mockConfig = { openaiApiKey: "test-key" };
    vi.mocked(configLoader.loadConfig).mockResolvedValue(Ok(mockConfig));

    const result = await validateConfig();

    expect(result.ok).toBe(true);
    expect(result.val).toEqual(mockConfig);
  });

  it("should prompt for API key when config not found", async () => {
    vi.mocked(configLoader.loadConfig).mockResolvedValue(
      Err({
        type: "CONFIGURATION_ERROR",
        code: "CONFIG_READ_ERROR",
        message: "Config file not found",
      })
    );
    vi.mocked(prompt.promptForApiKey).mockResolvedValue(Ok("new-key"));
    vi.mocked(configLoader.saveConfig).mockResolvedValue(Ok(undefined));

    const result = await validateConfig();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.val).toEqual({ openaiApiKey: "new-key" });
    }
    expect(configLoader.saveConfig).toHaveBeenCalledWith({
      openaiApiKey: "new-key",
    });
  });

  it("should return error when prompt is cancelled", async () => {
    vi.mocked(configLoader.loadConfig).mockResolvedValue(
      Err({
        type: "CONFIGURATION_ERROR",
        code: "MISSING_API_KEY",
        message: "No API key found",
      })
    );
    vi.mocked(prompt.promptForApiKey).mockResolvedValue(
      Err({
        code: "CANCELLED",
        message: "User cancelled",
      })
    );

    const result = await validateConfig();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.val).toEqual({
        type: "CONFIGURATION_ERROR",
        code: "MISSING_API_KEY",
        message: "OpenAI API key is required to run this tool",
      });
    }
  });

  it("should return error when save fails", async () => {
    vi.mocked(configLoader.loadConfig).mockResolvedValue(
      Err({
        type: "CONFIGURATION_ERROR",
        code: "CONFIG_READ_ERROR",
        message: "Config file not found",
      })
    );
    vi.mocked(prompt.promptForApiKey).mockResolvedValue(Ok("new-key"));
    const saveError: ConfigurationError = {
      type: "CONFIGURATION_ERROR",
      code: "INVALID_CONFIG_FILE",
      message: "Save failed",
    };
    vi.mocked(configLoader.saveConfig).mockResolvedValue(Err(saveError));

    const result = await validateConfig();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.val).toEqual({
        type: "CONFIGURATION_ERROR",
        code: "INVALID_CONFIG_FILE",
        message: "Save failed",
      });
    }
  });

  it("should pass through other errors unchanged", async () => {
    const error: ConfigurationError = {
      type: "CONFIGURATION_ERROR",
      code: "INVALID_CONFIG_FILE",
      message: "Invalid JSON",
    };
    vi.mocked(configLoader.loadConfig).mockResolvedValue(Err(error));

    const result = await validateConfig();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.val).toEqual(error);
    }
  });
});
