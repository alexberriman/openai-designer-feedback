export interface Config {
  openaiApiKey: string;
}

export interface ConfigOptions {
  apiKey?: string;
  configPath?: string;
}

export interface ConfigError {
  code: "CONFIG_NOT_FOUND" | "INVALID_CONFIG" | "NO_API_KEY";
  message: string;
}
