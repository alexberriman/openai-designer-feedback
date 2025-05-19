import { Err, Ok, Result } from "ts-results";
import type { ViewportDimensions, ViewportPreset } from "../types/cli.js";

export interface ValidationError {
  message: string;
  field?: string;
}

export function validateUrl(url: string): Result<string, ValidationError> {
  if (!url || url.trim().length === 0) {
    return Err({ message: "URL is required" });
  }

  // Add protocol if missing
  let validUrl = url;
  if (!/^https?:\/\//.test(url)) {
    validUrl = `https://${url}`;
  }

  try {
    new URL(validUrl);
    return Ok(validUrl);
  } catch {
    return Err({ message: "Invalid URL format", field: "url" });
  }
}

export function validateViewport(viewport?: string): Result<ViewportDimensions, ValidationError> {
  if (!viewport) {
    return Ok({ width: 1920, height: 1080 }); // Default desktop viewport
  }

  const viewportPresets: Record<ViewportPreset, ViewportDimensions> = {
    mobile: { width: 375, height: 812 },
    tablet: { width: 768, height: 1024 },
    desktop: { width: 1920, height: 1080 },
  };

  // Check if it's a preset
  if (viewport.toLowerCase() in viewportPresets) {
    return Ok(viewportPresets[viewport.toLowerCase() as ViewportPreset]);
  }

  // Check if it's a custom size (WIDTHxHEIGHT)
  const customMatch = /^(\d+)x(\d+)$/.exec(viewport);
  if (customMatch) {
    const width = Number.parseInt(customMatch[1], 10);
    const height = Number.parseInt(customMatch[2], 10);

    if (width < 320 || width > 3840) {
      return Err({ message: "Width must be between 320 and 3840", field: "viewport" });
    }
    if (height < 240 || height > 2160) {
      return Err({ message: "Height must be between 240 and 2160", field: "viewport" });
    }

    return Ok({ width, height });
  }

  return Err({
    message: "Invalid viewport format. Use 'mobile', 'tablet', 'desktop' or 'WIDTHxHEIGHT'",
    field: "viewport",
  });
}

export function validateWaitTime(wait?: string | number): Result<number, ValidationError> {
  if (!wait) {
    return Ok(0);
  }

  const waitTime = typeof wait === "string" ? Number.parseInt(wait, 10) : wait;

  if (Number.isNaN(waitTime) || waitTime < 0) {
    return Err({ message: "Wait time must be a positive number", field: "wait" });
  }

  if (waitTime > 60) {
    return Err({ message: "Wait time cannot exceed 60 seconds", field: "wait" });
  }

  return Ok(waitTime);
}

export function validateQuality(quality?: string | number): Result<number, ValidationError> {
  if (!quality) {
    return Ok(90); // Default JPEG quality
  }

  const qualityValue = typeof quality === "string" ? Number.parseInt(quality, 10) : quality;

  if (Number.isNaN(qualityValue) || qualityValue < 0 || qualityValue > 100) {
    return Err({ message: "Quality must be between 0 and 100", field: "quality" });
  }

  return Ok(qualityValue);
}

export function validateFormat(format?: string): Result<"json" | "text", ValidationError> {
  if (!format) {
    return Ok("text");
  }

  const normalizedFormat = format.toLowerCase();
  if (normalizedFormat !== "json" && normalizedFormat !== "text") {
    return Err({ message: "Format must be 'json' or 'text'", field: "format" });
  }

  return Ok(normalizedFormat as "json" | "text");
}
