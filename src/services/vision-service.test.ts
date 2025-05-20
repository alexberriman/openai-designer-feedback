import { describe, it, expect, vi, beforeEach } from "vitest";
import { VisionService } from "./vision-service.js";
import { readFile } from "node:fs/promises";
import OpenAI from "openai";

// Mock modules
vi.mock("node:fs/promises");
vi.mock("openai");
vi.mock("../utils/logger.js", () => ({
  getGlobalLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  }),
}));

describe("VisionService", () => {
  let visionService: VisionService;
  const mockApiKey = "test-api-key";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("analyzeScreenshot", () => {
    it("should successfully analyze an image", async () => {
      // Mock file reading
      const mockBase64 = "fake-base64-string";
      vi.mocked(readFile).mockResolvedValue(Buffer.from(mockBase64));

      // Mock OpenAI response
      const mockCompletion = {
        choices: [
          {
            message: {
              content: "Critical issue: The main navigation is not visible on mobile devices.",
            },
          },
        ],
      };

      const mockCreate = vi.fn().mockResolvedValue(mockCompletion);
      const mockOpenAI = {
        chat: {
          completions: {
            create: mockCreate,
          },
        },
      };

      vi.mocked(OpenAI).mockImplementation(() => mockOpenAI as unknown as OpenAI);

      visionService = new VisionService(mockApiKey);

      const result = await visionService.analyzeScreenshot({
        imagePath: "test.jpg",
        viewport: "mobile",
        apiKey: mockApiKey,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.val.content).toContain("Critical issue");
        expect(result.val.viewport).toBe("mobile");
        expect(result.val.model).toBe("gpt-3.5-turbo"); // Updated model name
      }

      // Verify OpenAI was called with correct parameters
      expect(mockCreate).toHaveBeenCalledWith({
        model: "gpt-4o", // Updated model name
        messages: expect.arrayContaining([
          expect.objectContaining({
            role: "system",
            content: expect.stringContaining("experienced web designer"),
          }),
        ]),
        max_tokens: 1000,
        temperature: 0.7,
      });
    });

    it("should handle file read errors", async () => {
      vi.mocked(readFile).mockRejectedValue(new Error("File not found"));

      vi.mocked(OpenAI).mockImplementation(() => ({}) as unknown as OpenAI);
      visionService = new VisionService(mockApiKey);

      const result = await visionService.analyzeScreenshot({
        imagePath: "missing.jpg",
        viewport: "desktop",
        apiKey: mockApiKey,
      });

      expect(result.err).toBe(true);
      if (result.err) {
        expect(result.val.type).toBe("FILE_SYSTEM_ERROR");
        expect(result.val.message).toContain("Failed to read image file");
      }
    });

    it("should handle OpenAI API errors", async () => {
      vi.mocked(readFile).mockResolvedValue(Buffer.from("fake-base64"));

      const mockError = Object.assign(new Error("Invalid API key"), {
        status: 401,
        constructor: OpenAI.APIError,
      });
      Object.setPrototypeOf(mockError, OpenAI.APIError.prototype);
      const mockCreate = vi.fn().mockRejectedValue(mockError);
      const mockOpenAI = {
        chat: {
          completions: {
            create: mockCreate,
          },
        },
      };

      vi.mocked(OpenAI).mockImplementation(() => mockOpenAI as unknown as OpenAI);

      visionService = new VisionService(mockApiKey);

      const result = await visionService.analyzeScreenshot({
        imagePath: "test.jpg",
        viewport: "desktop",
        apiKey: "invalid-key",
      });

      expect(result.err).toBe(true);
      if (result.err) {
        expect(result.val.type).toBe("API_ERROR");
        expect(result.val.message).toContain("OpenAI API error");
        if (result.val.type === "API_ERROR") {
          expect(result.val.code).toBe("INVALID_KEY");
        }
      }
    });
  });
});
