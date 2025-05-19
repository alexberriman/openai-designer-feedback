import readline from "node:readline";
import { Result, Ok, Err } from "ts-results";

export interface PromptError {
  code: "CANCELLED" | "INPUT_ERROR";
  message: string;
}

export async function promptForApiKey(): Promise<Result<string, PromptError>> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question("Enter your OpenAI API key: ", (answer) => {
      rl.close();

      if (!answer.trim()) {
        resolve(
          Err({
            code: "CANCELLED",
            message: "API key entry cancelled or empty",
          })
        );
        return;
      }

      resolve(Ok(answer.trim()));
    });

    rl.on("SIGINT", () => {
      rl.close();
      resolve(
        Err({
          code: "CANCELLED",
          message: "API key entry cancelled",
        })
      );
    });
  });
}
