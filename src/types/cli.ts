export interface CliOptions {
  viewport?: string;
  output?: string;
  format?: "json" | "text";
  wait?: number;
  waitFor?: string;
  fullPage?: boolean;
  quality?: number;
  apiKey?: string;
  verbose?: boolean;
}

export interface ValidatedOptions extends CliOptions {
  url: string;
  format: "json" | "text";
  fullPage: boolean;
}

export interface ViewportDimensions {
  width: number;
  height: number;
}

export type ViewportPreset = "mobile" | "tablet" | "desktop";
