import { Command } from "commander";
import chalk from "chalk";
import type { CliOptions, ValidatedOptions } from "./types/cli.js";
import type { AnalysisResult } from "./types/analysis.js";
import type { FormatterResult } from "./utils/formatters/types.js";
import {
  validateUrl,
  validateViewport,
  validateWaitTime,
  validateQuality,
  validateFormat,
} from "./utils/validator.js";
import { configureLogger, getGlobalLogger } from "./utils/logger.js";
import { ensureApiKey } from "./utils/config-loader.js";
import tsResults from "ts-results";
const { Ok, Err } = tsResults;
import type { Result } from "ts-results";
import { AnalysisService } from "./services/analysis-service.js";
import type { AnalysisOptions } from "./types/analysis.js";
import { TextFormatter, JsonFormatter, writeOutputToFile } from "./utils/formatters/index.js";
import { createUserFriendlyError, getExitCode, type AppError } from "./types/errors.js";

const program = new Command();

program
  .name("design-feedback")
  .description("Get professional web design/UX feedback from OpenAI")
  .version("0.1.0")
  .argument("<url>", "URL of the website to analyze")
  .option("-v, --viewport <size>", "Viewport size (mobile, tablet, desktop, or WIDTHxHEIGHT)")
  .option("-o, --output <path>", "Screenshot output path")
  .option("-f, --format <format>", "Output format (json, text)", "text")
  .option("-w, --wait <seconds>", "Wait time before screenshot (seconds)")
  .option("--wait-for <selector>", "Wait for specific element")
  .option("--full-page", "Capture full page (default: true)")
  .option("--no-full-page", "Capture viewport only")
  .option("--quality <number>", "JPEG quality (0-100)", "90")
  .option("--api-key <key>", "Override default OpenAI API key")
  .option("--verbose", "Enable verbose logging")
  .option("-s, --save <path>", "Save output to file")
  .option("--no-design", "Skip visual design recommendations (enabled by default)")
  .action(async (url: string, options: CliOptions) => {
    // Configure logger with verbose mode if requested
    configureLogger({ verbose: options.verbose });
    const logger = getGlobalLogger();

    logger.debugObject("Starting design feedback CLI", { url, options });

    // Setup simple signal handlers for clean termination
    process.on("SIGINT", () => {
      logger.debug("Received SIGINT signal - terminating");
      exitWithTimeout(0, "SIGINT signal", logger);
    });

    process.on("SIGTERM", () => {
      logger.debug("Received SIGTERM signal - terminating");
      exitWithTimeout(0, "SIGTERM signal", logger);
    });

    try {
      // Step 1: Validate inputs and get API key
      const prepResult = await validateAndPrepare(url, options, logger);
      // If undefined, validation failed and error handling has already executed
      if (!prepResult) return;

      const { validatedOptions, apiKey } = prepResult;

      // Step 2: Perform analysis
      const analysis = await runAnalysis(validatedOptions, apiKey, logger);
      // If undefined, analysis failed and error handling has already executed
      if (!analysis) return;

      // Step 3: Format and output results
      await formatAndOutputResults(analysis, validatedOptions, logger);

      // Explicitly signal that we're done
      logger.debug("Command completed successfully, freeing resources");

      // Show completion message if verbose
      if (options.verbose) {
        console.error(chalk.gray("Command completed. Exiting..."));
      }

      // Use our helper to exit cleanly with a timeout
      exitWithTimeout(0, "successful completion", logger);
    } catch (error) {
      handleUnexpectedError(error, logger);
    }
  });

/**
 * Validate inputs and prepare for analysis
 */
async function validateAndPrepare(
  url: string,
  options: CliOptions,
  logger: ReturnType<typeof getGlobalLogger>
) {
  // Validate all inputs
  const validations = await validateOptions(url, options);
  if (validations.err) {
    const validationError: AppError = {
      type: "VALIDATION_ERROR",
      code: "INVALID_OPTION",
      message: validations.val,
    };
    logger.errorObject("Validation failed", validationError);
    console.error(chalk.red(createUserFriendlyError(validationError)));

    // Get the exit code and use our helper to exit cleanly
    const exitCode = getExitCode(validationError);
    exitWithTimeout(exitCode, "validation error", logger);
    // Exit early, allowing the timeout to work
    return;
  }

  const validatedOptions = validations.val;
  logger.info(`Analyzing website: ${validatedOptions.url}`);

  // Ensure we have an API key
  const apiKeyResult = await ensureApiKey(validatedOptions.apiKey);
  if (apiKeyResult.err) {
    const error = apiKeyResult.val as AppError;
    logger.errorObject("API key error", error);
    console.error(chalk.red(createUserFriendlyError(error)));

    // Get the exit code and use our helper to exit cleanly
    const exitCode = getExitCode(error);
    exitWithTimeout(exitCode, "API key error", logger);
    // Exit early, allowing the timeout to work
    return;
  }

  return { validatedOptions, apiKey: apiKeyResult.val };
}

/**
 * Run analysis with validated inputs
 */
async function runAnalysis(
  options: ValidatedOptions,
  apiKey: string,
  logger: ReturnType<typeof getGlobalLogger>
) {
  logger.info("Starting website analysis...");
  const analysisService = new AnalysisService(apiKey);
  const analysisOptions: AnalysisOptions = {
    url: options.url,
    viewport: options.viewport || "desktop",
    apiKey,
    outputFormat: options.format,
    outputPath: options.output,
    verbose: options.verbose,
    fullPage: options.fullPage !== false,
    includeDesignRecommendations: options.design !== false, // Enabled by default
  };

  const analysisResult = await analysisService.analyzeWebsite(analysisOptions);
  if (analysisResult.err) {
    const error = analysisResult.val as AppError;
    logger.errorObject("Analysis error", error);
    console.error(chalk.red(createUserFriendlyError(error)));

    // Get the exit code and use our helper to exit cleanly
    const exitCode = getExitCode(error);
    exitWithTimeout(exitCode, "analysis error", logger);
    // Exit early, allowing the timeout to work
    return;
  }

  return analysisResult.val;
}

/**
 * Format analysis results and output to console/file
 */
async function formatAndOutputResults(
  analysis: AnalysisResult,
  options: ValidatedOptions,
  logger: ReturnType<typeof getGlobalLogger>
) {
  // Format output
  const formatter = options.format === "json" ? new JsonFormatter() : new TextFormatter();

  const formatterOptions = {
    verbose: options.verbose,
    color: true,
    outputPath: options.save,
  };

  const formatted = formatter.format(analysis, formatterOptions);

  // Save to file if requested
  if (options.save) {
    await saveToFile(formatted, options.save, logger);
    // Print a confirmation message but not the content
    console.log(chalk.green(`\n✓ Analysis saved to: ${options.save}`));
  } else {
    // Output to console only if not saving to file
    console.log(formatted.content);
  }
}

/**
 * Save formatted output to file
 */
async function saveToFile(
  formatted: FormatterResult,
  savePath: string,
  logger: ReturnType<typeof getGlobalLogger>
) {
  const saveResult = await writeOutputToFile(formatted, savePath);
  if (!saveResult.ok) {
    const error = saveResult.val as AppError;
    logger.errorObject("Failed to save output", error);
    console.error(chalk.red(createUserFriendlyError(error)));

    // Get the exit code and use our helper to exit cleanly
    const exitCode = getExitCode(error);
    exitWithTimeout(exitCode, "file save error", logger);
    // Exit early, allowing the timeout to work
  }
  // Return silently on success - the caller will handle messaging
}

/**
 * Attempt to close a Node.js handle (socket, timer, etc.)
 */
function tryCloseHandle(
  handle: unknown,
  index: number,
  reason: string,
  logger: ReturnType<typeof getGlobalLogger>
): void {
  try {
    // We need to check dynamically if the handle has a close method
    type HandleWithClose = { close: () => void };

    // Handle sockets/servers/etc that have a close method
    if (handle && typeof (handle as { close?: () => void }).close === "function") {
      (handle as HandleWithClose).close();
      logger.debug(`${reason}: Closed handle ${index}`);
    }

    // Handle timers that can be cleared
    if (handle && typeof (handle as { unref?: () => void }).unref === "function") {
      (handle as { unref: () => void }).unref();
      logger.debug(`${reason}: Unref'd handle ${index}`);
    }
  } catch (handleError) {
    logger.debug(`${reason}: Error closing handle ${index}: ${String(handleError)}`);
  }
}

/**
 * Attempt to close all active handles to allow clean exit
 */
function closeActiveHandles(reason: string, logger: ReturnType<typeof getGlobalLogger>): void {
  try {
    // Use process._getActiveHandles which is an internal Node.js API that's not in the typings
    // but is available at runtime for debugging purposes
    const nodeProcess = process as unknown as { _getActiveHandles?: () => unknown[] };
    const handles = nodeProcess._getActiveHandles?.();

    if (handles && Array.isArray(handles)) {
      logger.debug(`${reason}: Found ${handles.length} active handles, attempting to close them`);

      for (const [i, handle] of handles.entries()) {
        tryCloseHandle(handle, i, reason, logger);
      }
    }
  } catch (handleError) {
    logger.debug(`${reason}: Error cleaning up handles: ${String(handleError)}`);
  }
}

/**
 * Exit the process with a timeout fallback to ensure we don't hang
 * This addresses the issue where the OpenAI client keeps the process alive
 */
function exitWithTimeout(
  exitCode: number,
  reason: string,
  logger: ReturnType<typeof getGlobalLogger>,
  timeoutMs: number = 500
): void {
  logger.debug(`Preparing to exit with code ${exitCode} due to ${reason}`);

  // First try a graceful exit with a short timeout
  logger.debug(`Setting a failsafe exit timeout of ${timeoutMs}ms for ${reason}`);

  // Set a timer to force exit if cleanup doesn't complete in time
  const exitTimeoutId = globalThis.setTimeout(() => {
    logger.debug(`${reason}: Exit timeout of ${timeoutMs}ms reached, forcing immediate exit`);
    process.exit(exitCode);
  }, timeoutMs);

  // Keeping the timeout reference unref'd allows Node to exit naturally
  // if all other handles are closed before timeout triggers
  exitTimeoutId.unref();

  // Close any handles that might be keeping the event loop running
  closeActiveHandles(reason, logger);

  // Try to give the process a small chance to exit naturally
  // This can happen if our cleanup allowed event loop to empty
  logger.debug(`${reason}: Waiting for natural exit or timeout (code: ${exitCode})`);

  // This is a last resort - if we reach this point, the process will exit
  // after the timeout we set above
  process.on("exit", (code) => {
    logger.debug(`Process exiting with code ${code}`);
  });
}

/**
 * Handle unexpected errors
 */
function handleUnexpectedError(error: unknown, logger: ReturnType<typeof getGlobalLogger>) {
  logger.errorObject("Unexpected error", error);

  // Log critical errors properly using the logger
  logger.errorObject("Critical error in main handler", {
    errorType: error instanceof Error ? error.constructor.name : typeof error,
    errorMessage: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : "No stack trace",
  });

  const genericError: AppError = {
    type: "ANALYSIS_ERROR",
    code: "PROCESSING_FAILED",
    message: error instanceof Error ? error.message : "An unexpected error occurred",
  };
  console.error(chalk.red(createUserFriendlyError(genericError)));

  // Get the exit code and use our helper to exit cleanly
  const exitCode = getExitCode(genericError);
  exitWithTimeout(exitCode, "unexpected error", logger);
}

async function validateOptions(
  url: string,
  options: CliOptions
): Promise<Result<ValidatedOptions, string>> {
  // Validate URL
  const urlResult = validateUrl(url);
  if (urlResult.err) {
    return Err(urlResult.val.message);
  }

  // Validate viewport
  const viewportResult = validateViewport(options.viewport);
  if (viewportResult.err) {
    return Err(viewportResult.val.message);
  }

  // Validate wait time
  const waitResult = validateWaitTime(options.wait);
  if (waitResult.err) {
    return Err(waitResult.val.message);
  }

  // Validate quality
  const qualityResult = validateQuality(options.quality);
  if (qualityResult.err) {
    return Err(qualityResult.val.message);
  }

  // Validate format
  const formatResult = validateFormat(options.format);
  if (formatResult.err) {
    return Err(formatResult.val.message);
  }

  const validatedOptions: ValidatedOptions = {
    url: urlResult.val,
    viewport: viewportResult.val?.width + "x" + viewportResult.val?.height || "desktop",
    output: options.output,
    format: formatResult.val,
    wait: waitResult.val,
    waitFor: options.waitFor,
    fullPage: options.fullPage !== false,
    quality: qualityResult.val,
    apiKey: options.apiKey,
    verbose: options.verbose,
    save: options.save,
  };

  return Ok(validatedOptions);
}

export { program };

// Parse when executed directly (not imported)
if (import.meta.url === `file://${process.argv[1]}`) {
  program.parse();
}
