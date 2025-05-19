import tsResults from "ts-results";
const { Ok, Err } = tsResults;
import type { Result } from "ts-results";
import { loadConfig, saveConfig } from "./config-loader.js";
import { promptForApiKey } from "../utils/prompt.js";
import type { Config, ConfigError, ConfigOptions } from "../types/config.js";

export async function validateConfig(
  options: ConfigOptions = {}
): Promise<Result<Config, ConfigError>> {
  const configResult = await loadConfig(options);

  if (configResult.ok) {
    return configResult;
  }

  // Check if we need to prompt for API key
  const errorCode = configResult.val.code;
  if (errorCode === "CONFIG_READ_ERROR" || errorCode === "MISSING_API_KEY") {
    console.log("No OpenAI API key found.");
    console.log("You can provide it in one of the following ways:");
    console.log("1. Set the OPENAI_API_KEY environment variable");
    console.log("2. Use the --api-key command line option");
    console.log("3. Enter it now to save to config file");
    console.log("");

    const promptResult = await promptForApiKey();

    if (!promptResult.ok) {
      return Err({
        type: "CONFIGURATION_ERROR",
        code: "MISSING_API_KEY",
        message: "OpenAI API key is required to run this tool",
      });
    }

    const config: Config = { openaiApiKey: promptResult.val };
    const saveResult = await saveConfig(config);

    if (!saveResult.ok) {
      return Err(saveResult.val);
    }

    console.log("API key saved to config file.");
    return Ok(config);
  }

  return configResult;
}
