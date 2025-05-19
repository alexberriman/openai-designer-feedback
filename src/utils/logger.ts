import pino from "pino";
import type { Logger } from "pino";

export interface LoggerOptions {
  verbose?: boolean;
}

export function createLogger(options: LoggerOptions = {}): Logger {
  const isTest = process.env.NODE_ENV === "test" || process.env.VITEST === "true";

  if (isTest) {
    return pino({
      level: "silent",
    });
  }

  return pino({
    level: options.verbose ? "debug" : "info",
    transport: {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "HH:MM:ss",
        ignore: "pid,hostname",
      },
    },
  });
}

// Global logger instance that can be reconfigured
let globalLogger: Logger | null = null;

/**
 * Get the global logger instance, creating it if necessary
 */
export function getGlobalLogger(): Logger {
  if (!globalLogger) {
    globalLogger = createLogger({ verbose: process.env.VERBOSE === "true" });
  }
  return globalLogger;
}

/**
 * Configure the global logger with new options
 */
export function configureLogger(options: LoggerOptions): void {
  globalLogger = createLogger(options);
}

// Export a default logger instance
export const logger = getGlobalLogger();
