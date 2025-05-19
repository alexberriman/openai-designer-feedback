import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: false,
  clean: true,
  target: "node18",
  splitting: false,
  minify: false,
  platform: "node",
  shims: false,
});
