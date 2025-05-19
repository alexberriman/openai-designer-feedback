import { defineConfig } from "tsup";

export default defineConfig([
  {
    // Build for library (minified)
    entry: ["src/index.ts"],
    format: ["esm"],
    dts: true,
    clean: true,
    target: "node18",
    splitting: false,
    minify: true,
    platform: "node",
    shims: false,
  },
  {
    // Build for CLI (not minified)
    entry: {
      cli: "src/cli.ts",
    },
    format: ["esm"],
    dts: false,
    target: "node18",
    splitting: false,
    minify: false,
    platform: "node",
    shims: false,
  },
]);
