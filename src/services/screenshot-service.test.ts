import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ScreenshotService } from "./screenshot-service.js";
import type { ScreenshotOptions } from "../types/screenshot.js";
import { existsSync } from "node:fs";
import { readFile, unlink } from "node:fs/promises";
import { exec, type ChildProcess } from "node:child_process";
import { tmpdir } from "node:os";

// Use OS temp directory for tests (safer than hardcoding)
const TEST_DIR = tmpdir();
const TEST_FILE = `${TEST_DIR}/test.png`;
const TEST_NONEXISTENT = `${TEST_DIR}/nonexistent.png`;

vi.mock("node:child_process");
vi.mock("node:fs");
vi.mock("node:fs/promises");
vi.mock("../utils/logger.js", () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  }),
}));

describe("ScreenshotService", () => {
  let service: ScreenshotService;

  beforeEach(() => {
    service = new ScreenshotService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("capture", () => {
    const mockOptions: ScreenshotOptions = {
      url: "https://example.com",
      viewport: "desktop",
      outputPath: TEST_FILE,
    };

    it("should capture screenshot successfully", async () => {
      vi.mocked(exec).mockImplementation((_cmd: unknown, callback: unknown) => {
        if (typeof callback === "function") {
          callback(null, { stdout: "", stderr: "" });
        }
        return {} as ChildProcess;
      });
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFile).mockResolvedValue(Buffer.from("test-image"));

      const result = await service.capture(mockOptions);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.val.path).toBe(TEST_FILE);
        expect(result.val.metadata.url).toBe("https://example.com");
        expect(result.val.base64).toBeDefined();
      }
    });

    it("should handle invalid URL", async () => {
      const invalidOptions = { ...mockOptions, url: "invalid-url" };

      const result = await service.capture(invalidOptions);

      expect(result.err).toBe(true);
      if (result.err) {
        expect(result.val.code).toBe("INVALID_URL");
      }
    });

    it("should handle screenshot capture failure", async () => {
      vi.mocked(exec).mockImplementation((_cmd: unknown, callback: unknown) => {
        if (typeof callback === "function") {
          callback(new Error("Command failed"), { stdout: "", stderr: "" });
        }
        return {} as ChildProcess;
      });
      vi.mocked(existsSync).mockReturnValue(false);

      const result = await service.capture(mockOptions);

      expect(result.err).toBe(true);
      if (result.err) {
        expect(result.val.code).toBe("SCREENSHOT_NOT_CREATED");
      }
    });

    it("should generate temp path when outputPath not provided", async () => {
      const optionsWithoutOutput = { ...mockOptions, outputPath: undefined };

      vi.mocked(exec).mockImplementation((cmd: unknown, callback: unknown) => {
        if (typeof cmd === "string") {
          // Verify it contains temp directory and screenshot prefix
          expect(cmd).toContain(TEST_DIR);
          expect(cmd).toContain("screenshot-");
        }
        if (typeof callback === "function") {
          callback(null, { stdout: "", stderr: "" });
        }
        return {} as ChildProcess;
      });
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFile).mockResolvedValue(Buffer.from("test-image"));

      const result = await service.capture(optionsWithoutOutput);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.val.path).toContain("screenshot-");
        expect(result.val.path).toContain(".png");
      }
    });

    it("should build command with all options", async () => {
      const fullOptions: ScreenshotOptions = {
        url: "https://example.com",
        viewport: "mobile",
        outputPath: TEST_FILE,
        waitTime: 2,
        waitFor: ".loaded",
        quality: 80,
        fullPage: false,
      };

      vi.mocked(exec).mockImplementation((cmd: unknown, callback: unknown) => {
        if (typeof cmd === "string") {
          expect(cmd).toContain("-v mobile");
          expect(cmd).toContain("-w 2");
          expect(cmd).toContain('--wait-for ".loaded"');
          expect(cmd).toContain("--quality 80");
          expect(cmd).toContain("--no-full-page");
        }
        if (typeof callback === "function") {
          callback(null, { stdout: "", stderr: "" });
        }
        return {} as ChildProcess;
      });
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFile).mockResolvedValue(Buffer.from("test-image"));

      await service.capture(fullOptions);
    });
  });

  describe("cleanup", () => {
    it("should cleanup file successfully", async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(unlink).mockResolvedValue();

      const result = await service.cleanup(TEST_FILE);

      expect(result.ok).toBe(true);
      expect(vi.mocked(unlink)).toHaveBeenCalledWith(TEST_FILE);
    });

    it("should handle cleanup failure", async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(unlink).mockRejectedValue(new Error("Permission denied"));

      const result = await service.cleanup(TEST_FILE);

      expect(result.err).toBe(true);
      if (result.err) {
        expect(result.val.code).toBe("CLEANUP_FAILED");
      }
    });

    it("should skip cleanup if file does not exist", async () => {
      vi.mocked(existsSync).mockReturnValue(false);

      const result = await service.cleanup(TEST_NONEXISTENT);

      expect(result.ok).toBe(true);
      expect(vi.mocked(unlink)).not.toHaveBeenCalled();
    });
  });
});
