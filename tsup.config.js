export default {
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: false, // Disable for now
  sourcemap: true,
  clean: true,
  target: "es2022",
};