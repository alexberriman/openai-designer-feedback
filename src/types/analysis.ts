/**
 * Result of a design analysis
 */
export interface AnalysisResult {
  content: string;
  timestamp: string;
  viewport: string;
  model: string;
  analysisTime?: number;
  screenshotPath?: string;
  url?: string;
}

/**
 * Error types for analysis operations
 */
import type { AppError } from "./errors.js";

export type AnalysisError = AppError;

/**
 * Options for performing analysis
 */
export interface AnalysisOptions {
  url: string;
  viewport: string;
  apiKey: string;
  outputFormat?: "text" | "json";
  outputPath?: string;
  verbose?: boolean;
  fullPage?: boolean;
}

/**
 * Structured analysis output for JSON format
 */
export interface StructuredAnalysis {
  url: string;
  timestamp: string;
  viewport: string;
  model: string;
  issues: {
    critical: string[];
    major: string[];
    minor: string[];
  };
  summary: string;
  metadata: {
    analysisTime: number;
    screenshotPath?: string;
  };
}
