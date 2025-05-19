#!/usr/bin/env node

import { Command } from "commander";
import chalk from "chalk";
import type { CliOptions, ValidatedOptions } from "./types/cli.js";
import {
  validateUrl,
  validateViewport,
  validateWaitTime,
  validateQuality,
  validateFormat,
} from "./utils/validator.js";
import { configureLogger, getGlobalLogger } from "./utils/logger.js";
import { ensureApiKey } from "./utils/config-loader.js";
import { Result, Ok, Err } from "ts-results";
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
  .option("--no-full-page", "Capture viewport only (default: full page)")
  .option("--quality <number>", "JPEG quality (0-100)", "90")
  .option("--api-key <key>", "Override default OpenAI API key")
  .option("--verbose", "Enable verbose logging")
  .option("--save <path>", "Save output to file")
  .action(async (url: string, options: CliOptions) => {
    // Configure logger with verbose mode if requested
    configureLogger({ verbose: options.verbose });
    const logger = getGlobalLogger();

    logger.debug("Starting design feedback CLI", { url, options });

    try {
      // Validate all inputs
      const validations = await validateOptions(url, options);
      if (validations.err) {
        const validationError: AppError = {
          type: "VALIDATION_ERROR",
          code: "INVALID_OPTION",
          message: validations.val,
        };
        logger.error("Validation failed", validationError);
        console.error(chalk.red(createUserFriendlyError(validationError)));
        process.exit(getExitCode(validationError));
      }

      const validatedOptions = validations.val;
      logger.info(`Analyzing website: ${validatedOptions.url}`);

      // Ensure we have an API key
      const apiKeyResult = await ensureApiKey(validatedOptions.apiKey);
      if (apiKeyResult.err) {
        const error = apiKeyResult.val as AppError;
        logger.error("API key error", error);
        console.error(chalk.red(createUserFriendlyError(error)));
        process.exit(getExitCode(error));
      }

      // Perform analysis
      logger.info("Starting website analysis...");
      const analysisService = new AnalysisService(apiKeyResult.val);
      const analysisOptions: AnalysisOptions = {
        url: validatedOptions.url,
        viewport: validatedOptions.viewport || "desktop",
        apiKey: apiKeyResult.val,
        outputFormat: validatedOptions.format,
        outputPath: validatedOptions.output,
        verbose: validatedOptions.verbose,
      };

      const analysisResult = await analysisService.analyzeWebsite(analysisOptions);
      if (analysisResult.err) {
        const error = analysisResult.val as AppError;
        logger.error("Analysis error", error);
        console.error(chalk.red(createUserFriendlyError(error)));
        process.exit(getExitCode(error));
      }

      const analysis = analysisResult.val;

      // Format output
      const formatter =
        validatedOptions.format === "json" ? new JsonFormatter() : new TextFormatter();

      const formatterOptions = {
        verbose: validatedOptions.verbose,
        color: true,
        outputPath: validatedOptions.save,
      };

      const formatted = formatter.format(analysis, formatterOptions);

      // Output to console
      console.log(formatted.content);

      // Save to file if requested
      if (validatedOptions.save) {
        const saveResult = await writeOutputToFile(formatted, validatedOptions.save);
        if (saveResult.ok) {
          console.log(chalk.green(`\n✓ Output saved to: ${saveResult.val}`));
        } else {
          const error = saveResult.val as AppError;
          logger.error("Failed to save output", error);
          console.error(chalk.red(createUserFriendlyError(error)));
          process.exit(getExitCode(error));
        }
      }
    } catch (error) {
      logger.error("Unexpected error", error);
      const genericError: AppError = {
        type: "ANALYSIS_ERROR",
        code: "PROCESSING_FAILED",
        message: error instanceof Error ? error.message : "An unexpected error occurred",
      };
      console.error(chalk.red(createUserFriendlyError(genericError)));
      process.exit(getExitCode(genericError));
    }
  });

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
  };

  return Ok(validatedOptions);
}

program.parse();
