import { describe, expect, it } from "vitest";
import {
  validateUrl,
  validateViewport,
  validateWaitTime,
  validateQuality,
  validateFormat,
} from "./validator.js";

describe("validateUrl", () => {
  it("should validate correct URLs", () => {
    const result = validateUrl("https://example.com");
    expect(result.ok).toBe(true);
    expect(result.val).toBe("https://example.com");
  });

  it("should add https protocol if missing", () => {
    const result = validateUrl("example.com");
    expect(result.ok).toBe(true);
    expect(result.val).toBe("https://example.com");
  });

  it("should accept http protocol", () => {
    const result = validateUrl("http://example.com");
    expect(result.ok).toBe(true);
    expect(result.val).toBe("http://example.com");
  });

  it("should reject empty URLs", () => {
    const result = validateUrl("");
    expect(result.err).toBe(true);
    if (result.err) {
      expect(result.val.message).toBe("URL is required");
    }
  });

  it("should reject invalid URLs", () => {
    const result = validateUrl("not a url");
    expect(result.err).toBe(true);
    if (result.err) {
      expect(result.val.message).toBe("Invalid URL format");
    }
  });
});

describe("validateViewport", () => {
  it("should return default desktop viewport when none provided", () => {
    const result = validateViewport();
    expect(result.ok).toBe(true);
    expect(result.val).toEqual({ width: 1920, height: 1080 });
  });

  it("should accept preset viewports", () => {
    const mobile = validateViewport("mobile");
    expect(mobile.ok).toBe(true);
    expect(mobile.val).toEqual({ width: 375, height: 812 });

    const tablet = validateViewport("tablet");
    expect(tablet.ok).toBe(true);
    expect(tablet.val).toEqual({ width: 768, height: 1024 });

    const desktop = validateViewport("desktop");
    expect(desktop.ok).toBe(true);
    expect(desktop.val).toEqual({ width: 1920, height: 1080 });
  });

  it("should accept custom viewport sizes", () => {
    const result = validateViewport("1280x720");
    expect(result.ok).toBe(true);
    expect(result.val).toEqual({ width: 1280, height: 720 });
  });

  it("should reject invalid viewport formats", () => {
    const result = validateViewport("invalid");
    expect(result.err).toBe(true);
    if (result.err) {
      expect(result.val.message).toContain("Invalid viewport format");
    }
  });

  it("should reject viewport with invalid dimensions", () => {
    const tooSmall = validateViewport("100x100");
    expect(tooSmall.err).toBe(true);
    if (tooSmall.err) {
      expect(tooSmall.val.message).toContain("Width must be between");
    }

    const tooLarge = validateViewport("5000x5000");
    expect(tooLarge.err).toBe(true);
    if (tooLarge.err) {
      expect(tooLarge.val.message).toContain("Width must be between");
    }
  });
});

describe("validateWaitTime", () => {
  it("should return 0 when no wait time provided", () => {
    const result = validateWaitTime();
    expect(result.ok).toBe(true);
    expect(result.val).toBe(0);
  });

  it("should accept valid wait times", () => {
    const result = validateWaitTime(5);
    expect(result.ok).toBe(true);
    expect(result.val).toBe(5);
  });

  it("should parse string wait times", () => {
    const result = validateWaitTime("10");
    expect(result.ok).toBe(true);
    expect(result.val).toBe(10);
  });

  it("should reject negative wait times", () => {
    const result = validateWaitTime(-5);
    expect(result.err).toBe(true);
    if (result.err) {
      expect(result.val.message).toContain("must be a positive number");
    }
  });

  it("should reject wait times over 60 seconds", () => {
    const result = validateWaitTime(70);
    expect(result.err).toBe(true);
    if (result.err) {
      expect(result.val.message).toContain("cannot exceed 60 seconds");
    }
  });
});

describe("validateQuality", () => {
  it("should return default quality when none provided", () => {
    const result = validateQuality();
    expect(result.ok).toBe(true);
    expect(result.val).toBe(90);
  });

  it("should accept valid quality values", () => {
    const result = validateQuality(50);
    expect(result.ok).toBe(true);
    expect(result.val).toBe(50);
  });

  it("should reject quality values outside 0-100", () => {
    const tooLow = validateQuality(-1);
    expect(tooLow.err).toBe(true);
    if (tooLow.err) {
      expect(tooLow.val.message).toContain("must be between 0 and 100");
    }

    const tooHigh = validateQuality(101);
    expect(tooHigh.err).toBe(true);
    if (tooHigh.err) {
      expect(tooHigh.val.message).toContain("must be between 0 and 100");
    }
  });
});

describe("validateFormat", () => {
  it("should return default format when none provided", () => {
    const result = validateFormat();
    expect(result.ok).toBe(true);
    expect(result.val).toBe("text");
  });

  it("should accept valid formats", () => {
    const json = validateFormat("json");
    expect(json.ok).toBe(true);
    expect(json.val).toBe("json");

    const text = validateFormat("text");
    expect(text.ok).toBe(true);
    expect(text.val).toBe("text");
  });

  it("should reject invalid formats", () => {
    const result = validateFormat("xml");
    expect(result.err).toBe(true);
    if (result.err) {
      expect(result.val.message).toContain("must be 'json' or 'text'");
    }
  });
});
