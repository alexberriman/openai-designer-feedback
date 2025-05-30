export * from "./config.js";
export * from "./cli.js";
export * from "./screenshot.js";
export * from "./analysis.js";

export interface Viewport {
  width: number;
  height: number;
}

export type OutputFormat = "text" | "json";
