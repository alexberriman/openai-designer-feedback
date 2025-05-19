export interface ScreenshotOptions {
  url: string;
  viewport?: string;
  outputPath?: string;
  waitTime?: number;
  waitFor?: string;
  fullPage?: boolean;
  quality?: number;
}

export interface ScreenshotMetadata {
  viewportSize: string;
  timestamp: number;
  url: string;
  format: string;
}

export interface ScreenshotResult {
  path: string;
  metadata: ScreenshotMetadata;
  base64?: string;
}

import type { ScreenshotError as BaseScreenshotError } from "./errors.js";

export type ScreenshotError = BaseScreenshotError;
