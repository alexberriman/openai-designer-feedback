import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/cli.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  target: "node18",
  splitting: false,
  minify: false,
  platform: "node",
  shims: false,
});
