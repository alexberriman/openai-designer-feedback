import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Default test configuration
  },
  // Define modes for different environments
  modes: {
    // CI-specific configuration
    ci: {
      test: {
        environment: "node",
        threads: false,
        isolate: false,
        watch: false,
        globals: false,
      },
    },
  },
});