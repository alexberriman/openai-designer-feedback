import { describe, it, expect, vi, beforeEach } from "vitest";
import { writeOutputToFile } from "./file-writer.js";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

vi.mock("node:fs/promises");

describe("writeOutputToFile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should write content to file successfully", async () => {
    const mockContent = { content: "Test output" };
    const outputPath = "./output.txt";

    vi.mocked(mkdir).mockResolvedValue(undefined);
    vi.mocked(writeFile).mockResolvedValue(undefined);

    const result = await writeOutputToFile(mockContent, outputPath);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.val).toBe(outputPath);
    }

    expect(mkdir).toHaveBeenCalledWith(path.dirname(outputPath), { recursive: true });
    expect(writeFile).toHaveBeenCalledWith(outputPath, "Test output", "utf8");
  });

  it("should handle write errors", async () => {
    const mockContent = { content: "Test output" };
    const outputPath = "./invalid/path/output.txt";
    const mockError = new Error("Permission denied");

    vi.mocked(mkdir).mockRejectedValue(mockError);

    const result = await writeOutputToFile(mockContent, outputPath);

    expect(result.err).toBe(true);
    if (result.err) {
      expect(result.val.message).toContain("Permission denied");
      expect(result.val.path).toBe(outputPath);
    }
  });
});
