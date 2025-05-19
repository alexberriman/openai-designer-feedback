import { describe, it, expect } from "vitest";
import { TextFormatter } from "./text-formatter.js";
import type { AnalysisResult } from "../../types/analysis.js";

describe("TextFormatter", () => {
  const formatter = new TextFormatter();

  it("should format basic analysis result", () => {
    const result: AnalysisResult = {
      content:
        "Critical Issues:\n- Navigation menu is not visible\n\nMajor Issues:\n- Text is too small",
      timestamp: "2023-01-01T00:00:00Z",
      viewport: "mobile",
      model: "gpt-4-vision-preview",
      url: "https://example.com",
      analysisTime: 1500,
    };

    const formatted = formatter.format(result, { color: false });

    expect(formatted.content).toContain("✓ Design Analysis Complete");
    expect(formatted.content).toContain("URL: https://example.com");
    expect(formatted.content).toContain("Viewport: mobile");
    expect(formatted.content).toContain("Critical Issues");
    expect(formatted.content).toContain("Navigation menu is not visible");
    expect(formatted.content).toContain("Major Issues");
    expect(formatted.content).toContain("Text is too small");
  });

  it("should handle analysis without sections", () => {
    const result: AnalysisResult = {
      content: "The website has several navigation issues that need to be addressed.",
      timestamp: "2023-01-01T00:00:00Z",
      viewport: "desktop",
      model: "gpt-4-vision-preview",
    };

    const formatted = formatter.format(result);

    expect(formatted.content).toContain("✓ Design Analysis Complete");
    expect(formatted.content).toContain("The website has several navigation issues");
  });

  it("should format footer with metadata", () => {
    const result: AnalysisResult = {
      content: "Analysis content",
      timestamp: "2023-01-01T00:00:00Z",
      viewport: "tablet",
      model: "gpt-4-vision-preview",
      analysisTime: 2500,
      screenshotPath: "./screenshot.png",
    };

    const formatted = formatter.format(result, { color: false });

    expect(formatted.content).toContain("Analysis completed in 2500ms");
    expect(formatted.content).toContain("Screenshot: ./screenshot.png");
    expect(formatted.content).toContain("Model: gpt-4-vision-preview");
  });
});
