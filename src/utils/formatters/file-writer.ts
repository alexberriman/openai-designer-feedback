import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { Result, Ok, Err } from "ts-results";
import type { FormatterResult } from "./types.js";
import { logger } from "../logger.js";

export interface FileWriteError {
  message: string;
  path?: string;
  code?: string;
}

interface FileSystemError extends Error {
  code?: string;
}

/**
 * Writes formatter output to a file
 */
export async function writeOutputToFile(
  result: FormatterResult,
  outputPath: string
): Promise<Result<string, FileWriteError>> {
  try {
    // Ensure directory exists
    const dir = path.dirname(outputPath);
    await mkdir(dir, { recursive: true });

    // Write content to file
    await writeFile(outputPath, result.content, "utf8");

    logger.debug("Output written to file", { path: outputPath });
    return Ok(outputPath);
  } catch (error) {
    logger.error("Failed to write output to file", { error, path: outputPath });

    const fsError = error as FileSystemError;
    return Err({
      message: `Failed to write output to file: ${error instanceof Error ? error.message : "Unknown error"}`,
      path: outputPath,
      code: fsError.code,
    });
  }
}
