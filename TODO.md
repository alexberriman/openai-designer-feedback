# Design Feedback CLI Tool - TODO

## Overview
Create a CLI tool that captures website screenshots using @alexberriman/screenshotter and sends them to an OpenAI assistant for professional web design/UX feedback focused on critical issues and errors.

## Phase 1: Initial Setup

- [x] Set up Bun project with TypeScript configuration
- [x] Install and configure dependencies:
  - [x] `commander` for CLI interface
  - [x] `@alexberriman/screenshotter` for taking screenshots
  - [x] `openai` SDK for AI integration
  - [x] `ts-results` for error handling
  - [x] `pino` for logging
  - [x] `chalk` for colored console output
  - [x] TypeScript type definitions
- [x] Set up build pipeline with `tsup`
- [x] Create base project structure:
  ```
  src/
    index.ts          # CLI entry point
    commands/         # Command handlers
    services/         # OpenAI, screenshot services
    types/            # TypeScript interfaces
    utils/            # Utility functions
    config/           # Configuration handling
  ```

## Phase 2: Configuration Management

- [x] Create configuration loader for OpenAI API key
  - [x] Support environment variables (`OPENAI_API_KEY`)
  - [x] Support config file (~/.design-feedback/config.json)
  - [x] Interactive prompt if no API key found
- [x] Validate configuration on startup
- [x] Create config types and interfaces

## Phase 3: CLI Interface

- [x] Create main CLI command with Commander.js
- [x] Add command-line options:
  - [x] `--viewport, -v <size>` (mobile, tablet, desktop, or custom WIDTHxHEIGHT)
  - [x] `--output, -o <path>` (screenshot output path)
  - [x] `--format, -f <format>` (json, text - default: text)
  - [x] `--wait, -w <seconds>` (wait time before screenshot)
  - [x] `--wait-for <selector>` (wait for specific element)
  - [x] `--no-full-page` (capture viewport only)
  - [x] `--quality <number>` (JPEG quality 0-100)
  - [x] `--api-key <key>` (override default API key)
  - [x] `--verbose` (enable debug logging)
- [x] Add input validation for all options
- [x] Create help documentation
- [x] Handle error states gracefully

## Phase 4: Screenshot Service

- [x] Create wrapper service around @alexberriman/screenshotter (you can see readme for this repo: https://github.com/alexberriman/screenshotter)
- [x] Create interface for screenshot options:
  ```typescript
  interface ScreenshotOptions {
    url: string;
    viewport?: string;
    outputPath?: string;
    waitTime?: number;
    waitFor?: string;
    fullPage?: boolean;
    quality?: number;
  }
  ```
- [x] Implement screenshot capture with error handling
- [x] Return Result<ScreenshotResult, ScreenshotError>
- [x] Validate URL format before processing
- [x] Handle temporary file creation if no output path specified (store screenshot files in /tmp)
- [x] Add screenshot metadata (viewport size, timestamp)

## Phase 5: OpenAI Vision API to analyze screenshot ✅

OpenAI Vision:
- Use gpt-image-1 model for image analysis
- Pass screenshot as base64 encoded image

- [x] Create OpenAI vision analysis service using gpt-image-1
- [x] Implement vision model integration:
  - [x] Use gpt-image-1 model
  - [x] Convert screenshot to base64 format
  - [x] Create message with image content
  - [x] Configure system prompt with appropriate instructions:
    - Experience web designer/UX expert role
    - Focus on critical issues and errors
    - Avoid minor UI/UX suggestions
    - Consider device context (mobile vs desktop)
    - Call out all obvious design errors and issues
- [x] Create specific system prompt template:
  ```
  You are an experienced web designer and UX expert reviewing website screenshots. 
  Focus on identifying critical issues, errors, and fundamental problems rather 
  than minor UI improvements. Consider the device context ({viewport}) when 
  analyzing. Provide clear, actionable feedback about actual problems.
  ```
- [x] Handle model selection and fallbacks

## Phase 6: Analysis Service ✅

- [x] Create service to send screenshots to OpenAI assistant
- [x] Implement proper message formatting:
  - [x] Include viewport/device context
  - [x] Set appropriate system prompts
- [x] Handle API response parsing
- [x] Implement retry logic for API failures
- [x] Add timeout handling
- [x] Return Result<AnalysisResult, AnalysisError>

## Phase 7: Output Formatting ✅

- [x] Create output formatter interface
- [x] Implement text output formatter:
  - [x] Color-coded severity levels
  - [x] Clear section headers
  - [x] Bullet-pointed issues
  - [x] Readable console output
- [x] Implement JSON output formatter:
  - [x] Structured data format
  - [x] Include metadata (timestamp, URL, viewport)
  - [x] Categorized issues
- [x] Add option to save output to file

## Phase 8: Error Handling & Logging ✅

- [x] Create error messages for user-friendly output
- [x] Add debug logging with Pino
- [x] Implement proper exit codes
- [x] Add verbose mode for troubleshooting

## Phase 10: Documentation & Polish ✅

- [x] Write comprehensive README.md:
  - [x] Installation instructions
  - [x] Configuration guide
  - [x] Usage examples
  - [x] API key setup
  - [x] Output format examples

## Phase 11: Packaging & Distribution ✅

- [x] Configure package.json for npm publication ✅
- [x] Create executable binary versions ✅

## Technical Considerations

### Error Handling Strategy
- Use `ts-results` throughout for functional error handling
- Never throw exceptions except at boundaries
- Provide clear error messages to users
- Log detailed errors in verbose mode

### Performance
- Minimize dependencies
- Lazy load OpenAI client
- Stream large responses when possible
- Implement proper cleanup for temporary files

### Security
- Never log API keys
- Validate all user inputs
- Sanitize URLs before processing
- Use environment variables for sensitive data

### User Experience
- Provide progress indicators for long operations
- Clear, actionable error messages
- Intuitive command-line interface
- Helpful command hints and examples

### Code Quality
- Follow functional programming principles
- Keep functions small and focused
- Use TypeScript strict mode
- Maintain 80%+ test coverage
- Document all public APIs
