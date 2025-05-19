import { promises as fs } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { Err, Ok, Result } from "ts-results";
import { createInterface } from "node:readline";
import { stdin, stdout } from "node:process";

export interface Config {
  openaiApiKey?: string;
}

interface NodeError extends Error {
  code?: string;
}

const CONFIG_DIR = path.join(homedir(), ".design-feedback");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");

export async function loadConfig(): Promise<Result<Config, Error>> {
  try {
    // Check environment variable first
    const envKey = process.env.OPENAI_API_KEY;
    if (envKey) {
      return Ok({ openaiApiKey: envKey });
    }

    // Check config file
    try {
      const configContent = await fs.readFile(CONFIG_FILE, "utf8");
      const config = JSON.parse(configContent) as Config;
      return Ok(config);
    } catch (error) {
      // Config file doesn't exist or is invalid
      if ((error as NodeError).code !== "ENOENT") {
        return Err(new Error(`Failed to read config file: ${error}`));
      }
    }

    // No config found
    return Ok({});
  } catch (error) {
    return Err(new Error(`Failed to load config: ${error}`));
  }
}

export async function saveConfig(config: Config): Promise<Result<void, Error>> {
  try {
    await fs.mkdir(CONFIG_DIR, { recursive: true });
    await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2));
    return Ok(undefined);
  } catch (error) {
    return Err(new Error(`Failed to save config: ${error}`));
  }
}

export async function promptForApiKey(): Promise<string> {
  const rl = createInterface({
    input: stdin,
    output: stdout,
  });

  return new Promise((resolve) => {
    rl.question("Please enter your OpenAI API key: ", (apiKey) => {
      rl.close();
      resolve(apiKey.trim());
    });
  });
}

export async function ensureApiKey(providedKey?: string): Promise<Result<string, Error>> {
  if (providedKey) {
    return Ok(providedKey);
  }

  const configResult = await loadConfig();
  if (configResult.err) {
    return Err(configResult.val);
  }

  const config = configResult.val;
  if (config.openaiApiKey) {
    return Ok(config.openaiApiKey);
  }

  // No API key found, prompt for it
  const apiKey = await promptForApiKey();
  if (!apiKey) {
    return Err(new Error("API key is required"));
  }

  // Save the API key for future use
  const saveResult = await saveConfig({ ...config, openaiApiKey: apiKey });
  if (saveResult.err) {
    return Err(saveResult.val);
  }

  return Ok(apiKey);
}
