export const DEFAULT_CONFIG = {
  viewport: "desktop",
  wait: 2,
  fullPage: true,
  quality: 90,
  format: "text" as const,
} as const;

export const VIEWPORT_SIZES = {
  mobile: { width: 375, height: 812 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1440, height: 900 },
} as const;

export type ViewportType = keyof typeof VIEWPORT_SIZES;
