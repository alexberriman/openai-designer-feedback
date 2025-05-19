import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import { loadConfig, saveConfig } from "./config-loader.js";

vi.mock("node:fs", () => ({
  promises: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    mkdir: vi.fn(),
  },
}));

vi.mock("node:os", () => ({
  homedir: vi.fn(() => "/home/user"),
}));

describe("config-loader", () => {
  const mockFs = fs as unknown as {
    readFile: ReturnType<typeof vi.fn>;
    writeFile: ReturnType<typeof vi.fn>;
    mkdir: ReturnType<typeof vi.fn>;
  };
  const defaultConfigPath = path.join("/home/user", ".design-feedback", "config.json");

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OPENAI_API_KEY = "";
  });

  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
  });

  describe("loadConfig", () => {
    it("should return config with API key from options", async () => {
      const result = await loadConfig({ apiKey: "option-key-123" });

      expect(result.ok).toBe(true);
      expect(result.val).toEqual({ openaiApiKey: "option-key-123" });
    });

    it("should return config with API key from environment", async () => {
      process.env.OPENAI_API_KEY = "env-key-456";

      const result = await loadConfig();

      expect(result.ok).toBe(true);
      expect(result.val).toEqual({ openaiApiKey: "env-key-456" });
    });

    it("should return config from file when no options or env provided", async () => {
      mockFs.readFile.mockResolvedValue(JSON.stringify({ openaiApiKey: "file-key-789" }));

      const result = await loadConfig();

      expect(result.ok).toBe(true);
      expect(result.val).toEqual({ openaiApiKey: "file-key-789" });
      expect(mockFs.readFile).toHaveBeenCalledWith(defaultConfigPath, "utf8");
    });

    it("should return error when config file not found", async () => {
      const error = new Error("File not found") as Error & { code?: string };
      error.code = "ENOENT";
      mockFs.readFile.mockRejectedValue(error);

      const result = await loadConfig();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.val).toEqual({
          code: "CONFIG_NOT_FOUND",
          message: `Config file not found at ${defaultConfigPath}`,
        });
      }
    });

    it("should return error when config has no API key", async () => {
      mockFs.readFile.mockResolvedValue(JSON.stringify({}));

      const result = await loadConfig();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.val).toEqual({
          code: "NO_API_KEY",
          message: "No OpenAI API key found in config file",
        });
      }
    });

    it("should return error when config is invalid JSON", async () => {
      mockFs.readFile.mockResolvedValue("invalid json");

      const result = await loadConfig();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.val.code).toBe("INVALID_CONFIG");
      }
    });
  });

  describe("saveConfig", () => {
    it("should save config successfully", async () => {
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);

      const config = { openaiApiKey: "test-key" };
      const result = await saveConfig(config);

      expect(result.ok).toBe(true);
      expect(mockFs.mkdir).toHaveBeenCalledWith(path.dirname(defaultConfigPath), {
        recursive: true,
      });
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        defaultConfigPath,
        JSON.stringify(config, null, 2)
      );
    });

    it("should return error when save fails", async () => {
      mockFs.mkdir.mockRejectedValue(new Error("Permission denied"));

      const config = { openaiApiKey: "test-key" };
      const result = await saveConfig(config);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.val).toEqual({
          code: "INVALID_CONFIG",
          message: "Failed to save config: Permission denied",
        });
      }
    });
  });
});
