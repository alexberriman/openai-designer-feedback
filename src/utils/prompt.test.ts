import { describe, it, expect, vi, beforeEach } from "vitest";
import readline from "node:readline";
import { promptForApiKey } from "./prompt.js";

vi.mock("node:readline");

describe("promptForApiKey", () => {
  let mockInterface: {
    question: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
    on: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockInterface = {
      question: vi.fn(),
      close: vi.fn(),
      on: vi.fn(),
    };

    vi.mocked(readline.createInterface).mockReturnValue(
      mockInterface as unknown as readline.Interface
    );
  });

  it("should return API key when user provides valid input", async () => {
    mockInterface.question.mockImplementation(
      (_prompt: string, callback: (answer: string) => void) => {
        callback("  sk-test-key-123  ");
      }
    );

    const result = await promptForApiKey();

    expect(result.ok).toBe(true);
    expect(result.val).toBe("sk-test-key-123");
    expect(mockInterface.close).toHaveBeenCalled();
  });

  it("should return error when user provides empty input", async () => {
    mockInterface.question.mockImplementation(
      (_prompt: string, callback: (answer: string) => void) => {
        callback("");
      }
    );

    const result = await promptForApiKey();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.val).toEqual({
        code: "CANCELLED",
        message: "API key entry cancelled or empty",
      });
    }
  });

  it("should return error when user cancels with SIGINT", async () => {
    mockInterface.on.mockImplementation((event: string, callback: () => void) => {
      if (event === "SIGINT") {
        callback();
      }
    });

    const resultPromise = promptForApiKey();

    const result = await resultPromise;

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.val).toEqual({
        code: "CANCELLED",
        message: "API key entry cancelled",
      });
    }
  });
});
