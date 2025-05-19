import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  target: "node18",
  splitting: false,
  minify: true,
  platform: "node",
  shims: false,
  banner: {
    js: "#!/usr/bin/env node",
  },
  external: ["node:*"],
});
