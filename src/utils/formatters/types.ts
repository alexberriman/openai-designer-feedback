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
 * Interface for structured design recommendation
 */
export interface DesignRecommendation {
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
}

export interface StructuredOutput {
  url: string;
  timestamp: string;
  viewport: string;
  model: string;
  analysisTime?: number;
  screenshotPath?: string;
  pageDescription: string;
  summary: string;
  issues: StructuredIssue[];
  designRecommendations?: DesignRecommendation[];
  metadata: {
    version: string;
    cli: string;
  };
}
