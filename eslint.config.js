import unicorn from "eslint-plugin-unicorn";
import typescriptEslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import js from "@eslint/js";
import prettierConfig from "eslint-config-prettier";
import sonarjs from "eslint-plugin-sonarjs";

export default [
  js.configs.recommended,
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        project: "./tsconfig.json",
      },
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        // Node.js globals
        console: "readonly",
        process: "readonly",
        Buffer: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
        module: "readonly",
        exports: "readonly",
        require: "readonly",
        global: "readonly",
        // Browser globals for Playwright
        window: "readonly",
        document: "readonly",
      },
    },
    plugins: {
      "@typescript-eslint": typescriptEslint,
      "unicorn": unicorn,
      "sonarjs": sonarjs,
    },
    rules: {
      ...typescriptEslint.configs.recommended.rules,
      ...unicorn.configs.recommended.rules,
      ...sonarjs.configs.recommended.rules,
      
      // Basic styling
      "quotes": ["error", "double"],
      "semi": ["error", "always"],

      // Set specific rules
      "@typescript-eslint/no-unused-vars": "off",
      "sonarjs/no-useless-undefined": "off",
      "unicorn/no-useless-undefined": "off",
      "unicorn/no-null": "off",
      "unicorn/prevent-abbreviations": "off",
      // CLI applications need process.exit for proper exit codes
      "unicorn/no-process-exit": "off",
    },
  },
  // This disables rules that conflict with prettier
  prettierConfig,
];