@CLAUDE-CUSTOM.md
# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Bun backend project with automated testing and quality checks.

## Code Style Conventions

- **Case Style**: kebab-case
- **Indentation**: spaces (2 spaces)
- **Quotes**: double quotes
- **Line Length**: Maximum 100 characters
- **Trailing Commas**: Use trailing commas
- **Semicolons**: Use semicolons

### Code Organization

Code should be organized into focused modules with a clear separation of concerns.
Example:
```
src/
  features/                  # Functionality grouped by feature
    analyzers/               # Website analysis modules
      performance.ts         # Performance analysis module
      performance.test.ts    # Tests adjacent to implementation
  utils/                     # Shared utilities
  types/                     # TypeScript type definitions
```

### Test Files

Test files should follow the pattern: `{name}.test.ts`

## Preferred Technologies

Use the following technologies in this project:

### Backend Technology Stack

- **Runtime**: Bun
- **Language**: Typescript
- **Framework**: Express v5
- **Error Handling**: ts-results

### Backend Development Practices

- **TypeScript Usage**: 
  - Use strong typing - avoid `any` and `unknown` types
  - Create interfaces or type aliases for all data structures
  - Leverage union and intersection types where appropriate

- **Error Handling**:
  - Use Result<T, E> pattern from ts-results instead of exceptions
  - Return Ok(value) for successful operations
  - Return Err(error) for failure cases
  - Chain operations with map(), mapErr(), and andThen() methods

- **Code Organization**:
  - Create small, focused functions with single responsibility
  - Prefer pure functions when possible
  - Group related functionality into modules
  - Use barrel files (index.ts) to expose public APIs

### Utilities

- **Logging**: Pino
  - Configuration:
    - Log level: info
    - Pretty print: Enabled
    - Transport: pino-pretty
  - Do not use console.log - use appropriate log levels

### Testing

- **Unit Testing**: Vitest
  - Leveraging Vite for fast test execution
  - Do NOT use Jest configuration or dependencies
- **Component Testing**: Testing-library
- **Test Location**: Tests should be placed adjacent to implementation files
  - Do NOT use __tests__ directories

### Build Tools

- **Bundler**: Bun (built-in bundler)
- **CI/CD**: github-actions



## Project Architecture

Apply functional programming principles with a clear separation of concerns:

- **Feature-based modules**: Group related functionality by feature
- **Pure functions**: Prefer pure functions that avoid side effects
- **Result type**: Use Result<T, E> pattern for error handling
- **Type-driven design**: Let TypeScript types guide your implementation
- **Modularity**: Create small, reusable, single-responsibility modules
- **Testability**: Design for thorough unit testing


## Functional Programming Principles

This project follows functional programming principles:

- **Immutable data**: Avoid mutating data structures
- **Pure functions**: Functions should have no side effects
- **Function composition**: Build complex logic from simple functions
- **Result type**: Use Result<T, E> to handle success/failure
- **Early returns**: Use early returns to avoid nested conditionals
- **Small modules**: Create small, focused modules with a single responsibility


## File and Directory Structure

```
src/
  analyzers/            # Core analysis modules
    seo/                # SEO analysis
    performance/        # Performance analysis
    accessibility/      # Accessibility analysis
    security/           # Security analysis
  utils/                # Shared utilities
  types/                # TypeScript type definitions
  cli/                  # Command-line interface
  api/                  # API endpoints (if applicable)
tests/                  # Integration tests (component tests adjacent to source)
```


