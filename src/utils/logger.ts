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

  // Get log level from env variable or default based on verbose flag
  const logLevel = process.env.LOG_LEVEL || (options.verbose ? "debug" : "info");

  return pino({
    level: logLevel,
    transport: {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "HH:MM:ss",
        ignore: "pid,hostname",
        messageFormat: "{msg} {data}",
      },
    },
    serializers: {
      // Prevent circular references in error objects
      err: pino.stdSerializers.err,
      error: (error) => {
        if (error instanceof Error) {
          // Extract properties without using spread to avoid duplication
          const { name, message, stack, ...rest } = error as Error & Record<string, unknown>;
          return {
            name,
            message,
            stack,
            ...rest,
          };
        }
        return error;
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
