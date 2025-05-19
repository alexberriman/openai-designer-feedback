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

// Export a default logger instance
export const logger = createLogger({ verbose: process.env.LOG_LEVEL === "debug" });
