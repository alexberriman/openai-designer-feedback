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
import { createLogger } from "./utils/logger.js";
import { ensureApiKey } from "./utils/config-loader.js";
import { Result, Ok, Err } from "ts-results";
import { ScreenshotService } from "./services/screenshot-service.js";
import type { ScreenshotOptions } from "./types/screenshot.js";

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
  .action(async (url: string, options: CliOptions) => {
    const logger = createLogger({ verbose: options.verbose });

    try {
      // Validate all inputs
      const validations = await validateOptions(url, options);
      if (validations.err) {
        logger.error(validations.val);
        process.exit(1);
      }

      const validatedOptions = validations.val;
      logger.info(`Analyzing website: ${validatedOptions.url}`);

      // Ensure we have an API key
      const apiKeyResult = await ensureApiKey(validatedOptions.apiKey);
      if (apiKeyResult.err) {
        logger.error(`API key error: ${apiKeyResult.val.message}`);
        process.exit(1);
      }

      // Take screenshot
      logger.info("Taking screenshot...");
      const screenshotService = new ScreenshotService();
      const screenshotOptions: ScreenshotOptions = {
        url: validatedOptions.url,
        viewport: validatedOptions.viewport,
        outputPath: validatedOptions.output,
        waitTime: validatedOptions.wait,
        waitFor: validatedOptions.waitFor,
        fullPage: validatedOptions.fullPage,
        quality: validatedOptions.quality,
      };

      const screenshotResult = await screenshotService.capture(screenshotOptions);
      if (screenshotResult.err) {
        logger.error(`Screenshot error: ${screenshotResult.val.message}`);
        process.exit(1);
      }

      logger.info(`Screenshot saved to: ${screenshotResult.val.path}`);
      logger.info("Screenshot metadata", screenshotResult.val.metadata);

      // Implementation for analysis service will be added in Phase 5

      console.log(chalk.green("✓ Screenshot captured successfully"));
      console.log(chalk.blue(`📸 Screenshot: ${screenshotResult.val.path}`));
    } catch (error) {
      logger.error("Unexpected error", error);
      process.exit(1);
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
    viewport: options.viewport,
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
