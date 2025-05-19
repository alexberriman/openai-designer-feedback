import pino from "pino";
import type { Logger } from "pino";

export interface LoggerOptions {
  verbose?: boolean;
}

export function createLogger(options: LoggerOptions = {}): Logger {
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
