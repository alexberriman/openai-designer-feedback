export interface Config {
  openaiApiKey: string;
}

export interface ConfigOptions {
  apiKey?: string;
  configPath?: string;
}

import type { ConfigurationError } from "./errors.js";

export type ConfigError = ConfigurationError;
