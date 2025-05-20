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
  const logLevel = process.env.LOG_LEVEL || (options.verbose ? "debug" : "warn");

  return pino({
    level: logLevel,
    transport: {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "HH:MM:ss",
        ignore: "pid,hostname",
        singleLine: false,
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
// Enhanced logger that provides better object logging
export interface EnhancedLogger extends Logger {
  debugObject(msg: string, obj: unknown): void;
  infoObject(msg: string, obj: unknown): void;
  warnObject(msg: string, obj: unknown): void;
  errorObject(msg: string, obj: unknown): void;
}

export function getGlobalLogger(): EnhancedLogger {
  if (!globalLogger) {
    globalLogger = createLogger({
      verbose: process.env.VERBOSE === "true",
    });
  }

  // Add enhanced methods that stringify objects
  const enhancedLogger = globalLogger as EnhancedLogger;

  // Add object-specific logging methods that stringify objects
  enhancedLogger.debugObject = function (msg: string, obj: unknown) {
    // Stringify the object and format it nicely
    const formattedObj = formatObject(obj);
    this.debug(`${msg}\n${formattedObj}`);
  };

  enhancedLogger.infoObject = function (msg: string, obj: unknown) {
    const formattedObj = formatObject(obj);
    this.info(`${msg}\n${formattedObj}`);
  };

  enhancedLogger.warnObject = function (msg: string, obj: unknown) {
    const formattedObj = formatObject(obj);
    this.warn(`${msg}\n${formattedObj}`);
  };

  enhancedLogger.errorObject = function (msg: string, obj: unknown) {
    const formattedObj = formatObject(obj);
    this.error(`${msg}\n${formattedObj}`);
  };

  return enhancedLogger;
}

// Helper function to format objects for logging
function formatObject(obj: unknown): string {
  try {
    // Handle non-objects or null
    if (obj === null || typeof obj !== "object") {
      return `  ${String(obj)}`;
    }

    // Format each property on its own line with indentation
    return Object.entries(obj as Record<string, unknown>)
      .map(([key, value]) => {
        // Handle nested objects
        if (value && typeof value === "object") {
          try {
            return `  ${key}: ${JSON.stringify(value, null, 2).replaceAll("\n", "\n  ")}`;
          } catch {
            return `  ${key}: [Complex Object]`;
          }
        }
        return `  ${key}: ${value}`;
      })
      .join("\n");
  } catch (error) {
    return `  [Unable to format object: ${error instanceof Error ? error.message : String(error)}]`;
  }
}

/**
 * Configure the global logger with new options
 */
export function configureLogger(options: LoggerOptions): void {
  globalLogger = createLogger(options);
}

// Export a default logger instance
export const logger = getGlobalLogger();
