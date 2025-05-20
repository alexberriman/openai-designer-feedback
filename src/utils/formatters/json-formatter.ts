import type {
  OutputFormatter,
  FormatterOptions,
  FormatterResult,
  StructuredOutput,
  StructuredIssue,
} from "./types.js";
import type { AnalysisResult } from "../../types/analysis.js";

/**
 * JSON formatter for structured output
 */
export class JsonFormatter implements OutputFormatter {
  format(result: AnalysisResult, options?: FormatterOptions): FormatterResult {
    const structuredOutput = this.parseAnalysis(result);
    const content = JSON.stringify(structuredOutput, null, 2);
    return { content };
  }

  private parseAnalysis(result: AnalysisResult): StructuredOutput {
    const issues = this.extractIssues(result.content);
    const summary = this.extractSummary(result.content);

    return {
      url: result.url || "Unknown",
      timestamp: result.timestamp,
      viewport: result.viewport,
      model: result.model,
      analysisTime: result.analysisTime,
      screenshotPath: result.screenshotPath,
      summary,
      issues,
      metadata: {
        version: "0.1.0",
        cli: "@alexberriman/openai-designer-feedback",
      },
    };
  }

  private extractIssues(content: string): StructuredIssue[] {
    const issues: StructuredIssue[] = [];
    const lines = content.split("\n").filter((line) => line.trim());

    let currentSeverity: "critical" | "major" | "minor" = "major";
    let currentCategory = "General";

    for (const line of lines) {
      const trimmed = line.trim();

      // Check for severity headers
      if (trimmed.toLowerCase().includes("critical")) {
        currentSeverity = "critical";
        currentCategory = this.extractCategory(trimmed);
      } else if (trimmed.toLowerCase().includes("major")) {
        currentSeverity = "major";
        currentCategory = this.extractCategory(trimmed);
      } else if (trimmed.toLowerCase().includes("minor")) {
        currentSeverity = "minor";
        currentCategory = this.extractCategory(trimmed);
      }

      // Extract bullet points as issues
      if (trimmed.startsWith("-") || trimmed.startsWith("•")) {
        const description = trimmed.replace(/^[-•]\s*/, "").trim();
        if (description) {
          issues.push({
            severity: currentSeverity,
            category: currentCategory,
            description,
          });
        }
      }
    }

    // If no structured issues found, create one from the content but ONLY if it's not indicating no issues
    if (issues.length === 0 && content.trim()) {
      const trimmedContent = content.trim();

      // Don't add an issue if the content indicates there are no issues
      const noIssuesIndicators = [
        "no critical layout issues found",
        "no issues found",
        "no layout issues",
        "no visual issues",
        "no problems detected",
      ];

      const hasNoIssuesIndicator = noIssuesIndicators.some((indicator) =>
        trimmedContent.toLowerCase().includes(indicator.toLowerCase())
      );

      if (!hasNoIssuesIndicator) {
        issues.push({
          severity: "major",
          category: "General",
          description: trimmedContent,
        });
      }
    }

    return issues;
  }

  private extractCategory(header: string): string {
    // Try to extract category from headers like "Critical Issues - Navigation"
    const parts = header.split("-");
    if (parts.length > 1) {
      return parts[1].trim();
    }

    // Common categories
    if (header.toLowerCase().includes("navigation")) return "Navigation";
    if (header.toLowerCase().includes("layout")) return "Layout";
    if (header.toLowerCase().includes("responsive")) return "Responsiveness";
    if (header.toLowerCase().includes("accessibility")) return "Accessibility";
    if (header.toLowerCase().includes("performance")) return "Performance";
    if (header.toLowerCase().includes("visual")) return "Visual Design";
    if (header.toLowerCase().includes("content")) return "Content";

    return "General";
  }

  private extractSummary(content: string): string {
    // First, check if the content is a "no issues" response
    const noIssuesIndicators = [
      "no critical layout issues found",
      "no issues found",
      "no layout issues",
      "no visual issues",
      "no problems detected",
    ];

    const trimmedContent = content.trim();
    const hasNoIssuesIndicator = noIssuesIndicators.some((indicator) =>
      trimmedContent.toLowerCase().includes(indicator.toLowerCase())
    );

    if (hasNoIssuesIndicator) {
      return trimmedContent;
    }

    // Look for an overall assessment or summary section
    const lines = content.split("\n");
    const summaryIndex = lines.findIndex(
      (line) =>
        line.toLowerCase().includes("overall") ||
        line.toLowerCase().includes("summary") ||
        line.toLowerCase().includes("assessment")
    );

    if (summaryIndex !== -1) {
      // Extract the next few lines as summary
      const summaryLines = lines
        .slice(summaryIndex + 1, summaryIndex + 5)
        .filter((line) => line.trim() && !line.startsWith("-"))
        .join(" ");

      if (summaryLines.trim()) {
        return summaryLines.trim();
      }
    }

    // If no summary found, create one from the first non-header line
    const firstContent = lines.find(
      (line) =>
        line.trim() &&
        !this.isSeverityHeader(line) &&
        !line.startsWith("-") &&
        !line.startsWith("•")
    );

    return firstContent?.trim() || "Design analysis completed successfully.";
  }

  private isSeverityHeader(line: string): boolean {
    const headers = ["critical", "major", "minor", "issues", "recommendations", "assessment"];
    const lower = line.toLowerCase();
    return headers.some((header) => lower.includes(header));
  }
}
