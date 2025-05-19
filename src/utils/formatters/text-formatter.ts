import chalk from "chalk";
import type { OutputFormatter, FormatterOptions, FormatterResult } from "./types.js";
import type { AnalysisResult } from "../../types/analysis.js";

/**
 * Text formatter for console output
 */
export class TextFormatter implements OutputFormatter {
  format(result: AnalysisResult, options?: FormatterOptions): FormatterResult {
    const useColor = options?.color !== false;
    const lines: string[] = [
      this.formatHeader(result, useColor),
      "",
      this.formatAnalysis(result.content, useColor),
      "",
      this.formatFooter(result, useColor),
    ];

    const content = lines.join("\n");
    return { content };
  }

  private formatHeader(result: AnalysisResult, useColor: boolean): string {
    const header = [
      useColor ? chalk.green("✓ Design Analysis Complete") : "✓ Design Analysis Complete",
      "",
      `URL: ${useColor ? chalk.cyan(result.url || "Unknown") : result.url || "Unknown"}`,
      `Viewport: ${useColor ? chalk.blue(result.viewport) : result.viewport}`,
      `Timestamp: ${new Date(result.timestamp).toLocaleString()}`,
    ];

    return header.join("\n");
  }

  private formatAnalysis(content: string, useColor: boolean): string {
    const sections: string[] = [];

    // Split content into sections based on severity
    const lines = content.split("\n").filter((line) => line.trim());
    let currentSection: string[] = [];
    let currentSeverity = "";

    for (const line of lines) {
      if (this.isSeverityHeader(line)) {
        if (currentSection.length > 0) {
          sections.push(this.formatSection(currentSeverity, currentSection, useColor));
          currentSection = [];
        }
        currentSeverity = line;
      } else {
        currentSection.push(line);
      }
    }

    // Add the last section
    if (currentSection.length > 0) {
      sections.push(this.formatSection(currentSeverity, currentSection, useColor));
    }

    // If no sections were created, just format as general feedback
    if (sections.length === 0) {
      sections.push(this.formatSection("Feedback", content.split("\n"), useColor));
    }

    return sections.join("\n\n");
  }

  private isSeverityHeader(line: string): boolean {
    const headers = [
      "Critical Issues",
      "Major Issues",
      "Minor Issues",
      "Recommendations",
      "Overall Assessment",
    ];
    return headers.some((header) => line.toLowerCase().includes(header.toLowerCase()));
  }

  private formatSection(header: string, lines: string[], useColor: boolean): string {
    const formatted: string[] = [];

    // Format header based on severity
    if (useColor) {
      if (header.toLowerCase().includes("critical")) {
        formatted.push(chalk.red.bold(`🔴 ${header}`));
      } else if (header.toLowerCase().includes("major")) {
        formatted.push(chalk.yellow.bold(`🟡 ${header}`));
      } else if (header.toLowerCase().includes("minor")) {
        formatted.push(chalk.blue.bold(`🔵 ${header}`));
      } else {
        formatted.push(chalk.gray.bold(`ℹ️  ${header}`));
      }
    } else {
      formatted.push(`${header}`);
    }

    formatted.push(useColor ? chalk.gray("─".repeat(40)) : "─".repeat(40));

    // Format content lines
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed) {
        // Check if it's a bullet point
        if (trimmed.startsWith("-") || trimmed.startsWith("•")) {
          formatted.push(`  ${trimmed}`);
        } else {
          formatted.push(trimmed);
        }
      }
    }

    return formatted.join("\n");
  }

  private formatFooter(result: AnalysisResult, useColor: boolean): string {
    const footer: string[] = [];

    footer.push(useColor ? chalk.gray("─".repeat(50)) : "─".repeat(50));

    if (result.analysisTime) {
      footer.push(
        useColor
          ? chalk.gray(`Analysis completed in ${result.analysisTime}ms`)
          : `Analysis completed in ${result.analysisTime}ms`
      );
    }

    if (result.screenshotPath) {
      footer.push(
        useColor
          ? chalk.gray(`Screenshot: ${result.screenshotPath}`)
          : `Screenshot: ${result.screenshotPath}`
      );
    }

    footer.push(useColor ? chalk.gray(`Model: ${result.model}`) : `Model: ${result.model}`);

    return footer.join("\n");
  }
}
