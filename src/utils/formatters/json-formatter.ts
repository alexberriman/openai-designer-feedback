import type {
  OutputFormatter,
  FormatterOptions,
  FormatterResult,
  StructuredOutput,
  StructuredIssue,
} from "./types.js";
import type { AnalysisResult } from "../../types/analysis.js";

/**
 * Type for tracking current issue severity and category
 */
interface IssueMeta {
  severity: "critical" | "major" | "minor";
  category: string;
}

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
    const pageDescription = this.extractPageDescription(result.content);

    return {
      url: result.url || "Unknown",
      timestamp: result.timestamp,
      viewport: result.viewport,
      model: result.model,
      analysisTime: result.analysisTime,
      screenshotPath: result.screenshotPath,
      pageDescription,
      summary,
      issues,
      metadata: {
        version: "0.1.0",
        cli: "@alexberriman/openai-designer-feedback",
      },
    };
  }

  private extractPageDescription(content: string): string {
    // Look for line beginning with PAGE DESCRIPTION:
    const lines = content.split("\n");
    const descriptionLine = lines.find((line) =>
      line.trim().toLowerCase().startsWith("page description:")
    );

    if (descriptionLine) {
      return descriptionLine.replace(/^page description:\s*/i, "").trim();
    }

    // If no dedicated description found, return a fallback
    return "No page description provided.";
  }

  /**
   * Update current severity and category based on line content
   */
  private updateSeverityAndCategory(line: string, current: IssueMeta): void {
    const trimmed = line.trim().toLowerCase();

    if (trimmed.includes("critical")) {
      current.severity = "critical";
      current.category = this.extractCategory(line);
    } else if (trimmed.includes("major")) {
      current.severity = "major";
      current.category = this.extractCategory(line);
    } else if (trimmed.includes("minor")) {
      current.severity = "minor";
      current.category = this.extractCategory(line);
    }
  }

  /**
   * Process a single line to extract an issue if present
   */
  private processIssueLine(
    line: string,
    currentSeverity: "critical" | "major" | "minor",
    currentCategory: string
  ): StructuredIssue | null {
    const trimmed = line.trim();

    if (trimmed.startsWith("-") || trimmed.startsWith("•")) {
      const description = trimmed.replace(/^[-•]\s*/, "").trim();
      if (description) {
        return {
          severity: currentSeverity,
          category: currentCategory,
          description,
        };
      }
    }

    return null;
  }

  /**
   * Check if content contains "no issues" indicators
   */
  private containsNoIssuesIndicator(content: string): boolean {
    const noIssuesIndicators = [
      "no critical layout issues found",
      "no issues found",
      "no layout issues",
      "no visual issues",
      "no problems detected",
    ];

    return noIssuesIndicators.some((indicator) =>
      content.toLowerCase().includes(indicator.toLowerCase())
    );
  }

  /**
   * Extract issues from the analysis content
   */
  private extractIssues(content: string): StructuredIssue[] {
    const issues: StructuredIssue[] = [];
    const lines = content.split("\n").filter((line) => line.trim());

    // Initialize tracking variables
    const current: IssueMeta = {
      severity: "major",
      category: "General",
    };

    // Process each line
    for (const line of lines) {
      // Skip PAGE DESCRIPTION lines
      if (line.trim().toLowerCase().startsWith("page description:")) {
        continue;
      }

      // Update severity and category based on headers
      this.updateSeverityAndCategory(line, current);

      // Process issue line
      const issue = this.processIssueLine(line, current.severity, current.category);
      if (issue) {
        issues.push(issue);
      }
    }

    // If no structured issues found and not a "no issues" response, create a general issue
    const contentHasText = content.trim().length > 0;
    if (issues.length === 0 && contentHasText && !this.containsNoIssuesIndicator(content)) {
      issues.push({
        severity: "major",
        category: "General",
        description: content.trim(),
      });
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

  /**
   * Find a line containing one of the no issues indicators
   */
  private findNoIssuesLine(lines: string[], noIssuesIndicators: string[]): string | null {
    for (const line of lines) {
      if (
        noIssuesIndicators.some((indicator) =>
          line.trim().toLowerCase().includes(indicator.toLowerCase())
        )
      ) {
        return line.trim();
      }
    }
    return null;
  }

  /**
   * Find a summary section in the content
   */
  private findSummarySection(lines: string[]): string | null {
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

    return null;
  }

  /**
   * Extract a summary from the analysis content
   */
  private extractSummary(content: string): string {
    // First, define indicators of no issues
    const noIssuesIndicators = [
      "no critical layout issues found",
      "no issues found",
      "no layout issues",
      "no visual issues",
      "no problems detected",
    ];

    // Filter out PAGE DESCRIPTION line before processing
    const filteredLines = content
      .split("\n")
      .filter((line) => !line.trim().toLowerCase().startsWith("page description:"));

    const filteredContent = filteredLines.join("\n");
    const trimmedContent = filteredContent.trim();

    // Check for "no issues" indicators
    const hasNoIssuesIndicator = noIssuesIndicators.some((indicator) =>
      trimmedContent.toLowerCase().includes(indicator.toLowerCase())
    );

    if (hasNoIssuesIndicator) {
      // Extract the first line containing the no issues message
      const noIssuesLine = this.findNoIssuesLine(filteredLines, noIssuesIndicators);
      return noIssuesLine || trimmedContent;
    }

    // Look for an overall assessment or summary section
    const summarySection = this.findSummarySection(filteredLines);
    if (summarySection) {
      return summarySection;
    }

    // If no summary found, create one from the first non-header line
    const firstContent = filteredLines.find(
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
