import { describe, it, expect } from "vitest";
import { JsonFormatter } from "./json-formatter.js";
import type { AnalysisResult } from "../../types/analysis.js";

describe("JsonFormatter", () => {
  const formatter = new JsonFormatter();

  it("should format analysis result as JSON", () => {
    const result: AnalysisResult = {
      content:
        "Critical Issues:\n- Navigation menu is not visible\n- Layout breaks on mobile\n\nMajor Issues:\n- Text is too small",
      timestamp: "2023-01-01T00:00:00Z",
      viewport: "mobile",
      model: "gpt-4-vision-preview",
      url: "https://example.com",
      analysisTime: 1500,
      screenshotPath: "./screenshot.png",
    };

    const formatted = formatter.format(result);
    const parsed = JSON.parse(formatted.content);

    expect(parsed.url).toBe("https://example.com");
    expect(parsed.timestamp).toBe("2023-01-01T00:00:00Z");
    expect(parsed.viewport).toBe("mobile");
    expect(parsed.model).toBe("gpt-4-vision-preview");
    expect(parsed.analysisTime).toBe(1500);
    expect(parsed.screenshotPath).toBe("./screenshot.png");
    expect(parsed.metadata.version).toBe("0.1.0");
    expect(parsed.metadata.cli).toBe("@alexberriman/openai-designer-feedback");
  });

  it("should extract issues by severity", () => {
    const result: AnalysisResult = {
      content:
        "Critical Issues:\n- Navigation is broken\n\nMajor Issues:\n- Font too small\n\nMinor Issues:\n- Color contrast",
      timestamp: "2023-01-01T00:00:00Z",
      viewport: "desktop",
      model: "gpt-4-vision-preview",
    };

    const formatted = formatter.format(result);
    const parsed = JSON.parse(formatted.content);

    expect(parsed.issues).toHaveLength(3);
    expect(parsed.issues[0]).toEqual({
      severity: "critical",
      category: "General",
      description: "Navigation is broken",
    });
    expect(parsed.issues[1]).toEqual({
      severity: "major",
      category: "General",
      description: "Font too small",
    });
    expect(parsed.issues[2]).toEqual({
      severity: "minor",
      category: "General",
      description: "Color contrast",
    });
  });

  it("should handle unstructured content", () => {
    const result: AnalysisResult = {
      content: "The website has several issues that need attention.",
      timestamp: "2023-01-01T00:00:00Z",
      viewport: "mobile",
      model: "gpt-4-vision-preview",
    };

    const formatted = formatter.format(result);
    const parsed = JSON.parse(formatted.content);

    expect(parsed.issues).toHaveLength(1);
    expect(parsed.issues[0]).toEqual({
      severity: "major",
      category: "General",
      description: "The website has several issues that need attention.",
    });
  });

  it("should extract summary from content", () => {
    const result: AnalysisResult = {
      content:
        "Critical Issues:\n- Problem 1\n\nOverall Assessment:\nThe website needs major improvements to be usable.",
      timestamp: "2023-01-01T00:00:00Z",
      viewport: "desktop",
      model: "gpt-4-vision-preview",
    };

    const formatted = formatter.format(result);
    const parsed = JSON.parse(formatted.content);

    expect(parsed.summary).toBe("The website needs major improvements to be usable.");
  });
});
