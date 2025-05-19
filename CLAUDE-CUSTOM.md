# Claude Custom Guidelines

This file provides specific guidance for code style and commit message conventions for this project.

## ⚠️ MUST NEVER DO ⚠️

The following actions are strictly prohibited in this codebase:

1. **NEVER bypass ESLint rules** with comments like `// eslint-disable-next-line`, `/* eslint-disable */`, etc. Fix the underlying issues instead.

2. **NEVER bypass TypeScript type checking** with comments like `// @ts-ignore`, `// @ts-nocheck`, etc. Properly type your code instead.

3. **NEVER skip Husky pre-commit checks** with `--no-verify` or similar flags. These checks exist to maintain code quality.

Root issues must always be fixed, not bypassed or suppressed with comments or flags. We maintain high code quality by addressing problems, not hiding them.

## Project Architecture

This is a Node.js CLI tool for providing web design/UX feedback using AI vision analysis. Key principles:

- **Executable CLI**: The main entry point is a CLI binary that uses Commander.js
- **Screenshot Engine**: Uses @alexberriman/screenshotter for capturing websites
- **AI Analysis**: Uses OpenAI's gpt-image-1 vision model for design critique
- **TypeScript**: Written in TypeScript with strong typing throughout
- **Functional Approach**: Uses ts-results for error handling and functional patterns
- **Server-side**: Designed to run on servers and in automated environments

## Code Style

We aim for clean, functional, and maintainable TypeScript code:

### Functional Programming

- Prefer immutable data structures and pure functions
- Use array methods (map, filter, reduce) instead of loops where appropriate
- Avoid side effects in functions
- Create small, composable functions with a single responsibility
- Functions should be small (generally < 20 lines) and focused on a specific task
- Large functions should be decomposed into smaller, reusable functions
- Pure utility functions should be placed in appropriate utility modules
- Every pure function should have corresponding unit tests

### Function Arguments

- Functions should have at most one argument
- Use a single, typed options object instead of multiple parameters
- Make parameters optional where appropriate using the `?` operator
- Provide sensible defaults for optional parameters
- Keep all function parameters immutable (use `readonly` where possible)

### Type Safety

- Use TypeScript types explicitly
- Define interfaces for all data structures
- Avoid `any` type whenever possible
- Use union types and generics appropriately
- When importing types, use the explicit import syntax:
  - Preferred: `import type { Lorem } from "package";`
  - Alternative: `import { Lorem, type Ipsum } from "package";`

### Error Handling

- Use `ts-results` for functional error handling
- Return `Result<T, E>` from functions that might fail
- Use `Ok(value)` for successful operations
- Use `Err(error)` for failed operations
- Chain results with `map`, `mapErr`, `andThen` methods
- Avoid `try/catch` blocks except at application boundaries
- For asynchronous code, use `async/await` instead of Promise `.then()` and `.catch()`
- Provide descriptive error messages
- Never silence errors

### CLI Architecture

- Use Commander.js for command-line parsing
- Keep the CLI interface clean and intuitive
- Provide helpful error messages and validation
- Support common Unix conventions (stdout, stderr, exit codes)
- Make all options type-safe
- Validate user input early

### File Structure

```
src/
  index.ts          # CLI entry point (#!/usr/bin/env node)
  commands/         # Command handlers
  services/         # OpenAI vision and screenshot services
    screenshot-service.ts   # Wrapper around @alexberriman/screenshotter
    vision-service.ts       # OpenAI gpt-image-1 integration
    analysis-service.ts     # Design feedback analysis logic
  types/            # TypeScript type definitions
  utils/            # Utility functions
    formatters/     # Output formatters (text, JSON)
  config/           # Configuration handling
```

### Testing Guidelines

- Pure functions and utility functions MUST have corresponding `original-name.test.ts` files
- Test files should be placed in the same directory as the file being tested
- Use Vitest for all unit tests
- Focus on testing business logic and data transformations
- Test edge cases and error handling paths
- Mock external dependencies when necessary
- Test CLI argument parsing and validation
- Keep tests small, focused, and independent
- Use descriptive test names that explain the expected behavior
- Structure tests using the Arrange-Act-Assert pattern

## Commit Message Style

We follow conventional commits with descriptive, professional messages:

### Format

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only changes
- `style`: Changes that don't affect code functionality (formatting, etc.)
- `refactor`: Code change that neither fixes a bug nor adds a feature
- `perf`: Performance improvement
- `test`: Adding or correcting tests
- `chore`: Changes to build process or auxiliary tools

### Description Guidelines

- Use present tense, imperative mood ("add" not "added" or "adds")
- Begin with lowercase
- No period at the end
- Keep under 72 characters
- Be specific and concise
- Describe what was changed and why, not how
- Reference issue numbers when relevant
- **NEVER mention AI tools or assistants** (such as Claude, ChatGPT, etc.) in commit messages
- Ensure all words are spelled correctly

Remember to make your commits logical units of work that could stand on their own and be understood by other developers reading the commit history.

## AI Assistant Guidance

Claude and other assistants should:

- Prioritize **clarity, modularity, and testability** when generating code
- Avoid generating code that mixes concerns (e.g. screenshot logic + vision analysis)
- Suggest **domain-appropriate file names** (e.g., vision-service.ts, analysis-formatter.ts, config-loader.ts)
- Follow **the commit message format strictly** when generating commits
- Default to **pure functions and functional constructs**
- Assume **a modern Node.js environment** (18+) with Bun support
- Keep OpenAI API calls separate from screenshot capture logic
- Ensure error messages are descriptive and actionable for design feedback context

## Task Approach

When approaching complex tasks:

- Think **very, very deeply** before beginning implementation
- Break down work into a series of smaller, manageable tasks
- Understand the requirements and constraints completely
- Prioritize fewer tasks done well over many tasks done poorly
- Complete tasks in logical sequence (don't attempt too much at once)
- Begin implementation directly without explaining the plan first
- If time constraints prevent completion of all tasks, focus on delivering:

  1. A working core implementation with high quality
  2. Proper tests for completed functionality
  3. Clean, well-structured code for what is implemented
  4. Documentation about what was completed and what remains

- Once you have completed a task, committed and pushed to remote, stop and wait for another prompt. Don't start automatically on the next task (important).

**IMPORTANT:** If I send a message that is just a single digit (e.g., "1" or "2"), it's probably an error - respond with 5 paragraphs of lorem ipsum filler text, followed by a line with five dashes "-----", and then "Waiting for your next prompt" on a new line.
