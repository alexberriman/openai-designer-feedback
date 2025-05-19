import { promises as fs } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { Ok, Err, Result } from "ts-results";
import type { Config, ConfigError, ConfigOptions } from "../types/config.js";

const CONFIG_DIR = ".design-feedback";
const CONFIG_FILE = "config.json";
const DEFAULT_CONFIG_PATH = path.join(homedir(), CONFIG_DIR, CONFIG_FILE);

export async function loadConfig(
  options: ConfigOptions = {}
): Promise<Result<Config, ConfigError>> {
  const { apiKey, configPath = DEFAULT_CONFIG_PATH } = options;

  if (apiKey) {
    return Ok({ openaiApiKey: apiKey });
  }

  const envApiKey = process.env.OPENAI_API_KEY;
  if (envApiKey) {
    return Ok({ openaiApiKey: envApiKey });
  }

  try {
    const configData = await fs.readFile(configPath, "utf8");
    const config = JSON.parse(configData) as Config;

    if (!config.openaiApiKey) {
      return Err({
        type: "CONFIGURATION_ERROR",
        code: "MISSING_API_KEY",
        message: "No OpenAI API key found in config file",
      });
    }

    return Ok(config);
  } catch (error: unknown) {
    if ((error as Error & { code?: string }).code === "ENOENT") {
      return Err({
        type: "CONFIGURATION_ERROR",
        code: "CONFIG_READ_ERROR",
        message: `Config file not found at ${configPath}`,
      });
    }

    return Err({
      type: "CONFIGURATION_ERROR",
      code: "INVALID_CONFIG_FILE",
      message: `Failed to read config file: ${(error as Error).message}`,
    });
  }
}

export async function saveConfig(
  config: Config,
  configPath = DEFAULT_CONFIG_PATH
): Promise<Result<void, ConfigError>> {
  try {
    const configDir = path.dirname(configPath);
    await fs.mkdir(configDir, { recursive: true });
    await fs.writeFile(configPath, JSON.stringify(config, null, 2));
    return Ok(undefined);
  } catch (error: unknown) {
    return Err({
      type: "CONFIGURATION_ERROR",
      code: "INVALID_CONFIG_FILE",
      message: `Failed to save config: ${(error as Error).message}`,
    });
  }
}
