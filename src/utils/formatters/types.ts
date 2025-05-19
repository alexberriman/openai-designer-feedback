import type { AnalysisResult } from "../../types/analysis.js";

/**
 * Options for formatting output
 */
export interface FormatterOptions {
  verbose?: boolean;
  color?: boolean;
  outputPath?: string;
}

/**
 * Result of formatting operation
 */
export interface FormatterResult {
  content: string;
  filePath?: string;
}

/**
 * Interface for output formatters
 */
export interface OutputFormatter {
  format(result: AnalysisResult, options?: FormatterOptions): FormatterResult;
}

/**
 * Structured issue for JSON output
 */
export interface StructuredIssue {
  severity: "critical" | "major" | "minor";
  category: string;
  description: string;
}

/**
 * Structured output for JSON formatting
 */
export interface StructuredOutput {
  url: string;
  timestamp: string;
  viewport: string;
  model: string;
  analysisTime?: number;
  screenshotPath?: string;
  summary: string;
  issues: StructuredIssue[];
  metadata: {
    version: string;
    cli: string;
  };
}
