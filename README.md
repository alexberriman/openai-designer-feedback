# Design Feedback CLI

A command-line tool that captures screenshots of websites and provides expert web design/UX feedback using OpenAI's vision API. It focuses on identifying critical issues and fundamental problems rather than minor UI improvements.

## Features

- 📸 **Automated Screenshots**: Captures high-quality screenshots using [@alexberriman/screenshotter](https://github.com/alexberriman/screenshotter)
- 🤖 **AI-Powered Analysis**: Uses OpenAI's gpt-image-1 model to analyze design issues
- 📱 **Device-Aware**: Supports mobile, tablet, and desktop viewports
- 🎯 **Focused Feedback**: Identifies critical design errors and UX problems
- 📊 **Multiple Output Formats**: Supports both human-readable text and structured JSON
- ⚙️ **Flexible Configuration**: Environment variables, config files, and CLI arguments

## Installation

```bash
npm install -g @your-scope/design-feedback
```

Or use directly with npx:

```bash
npx @your-scope/design-feedback https://example.com
```

## Quick Start

```bash
# Basic usage
design-feedback https://example.com

# Mobile viewport with JSON output
design-feedback https://example.com -v mobile -f json

# Custom output path with wait time
design-feedback https://example.com -o ./screenshots/analysis.png -w 3

# Wait for specific element
design-feedback https://example.com --wait-for "#main-content"
```

## Configuration

### API Key Setup

The tool requires an OpenAI API key. You can provide it in three ways:

1. **Environment Variable** (recommended):
   ```bash
   export OPENAI_API_KEY=your-api-key
   ```

2. **Config File** (`~/.design-feedback/config.json`):
   ```json
   {
     "openaiApiKey": "your-api-key"
   }
   ```

3. **Command Line**:
   ```bash
   design-feedback https://example.com --api-key your-api-key
   ```

## Command Line Options

```
design-feedback <url> [options]

Options:
  -v, --viewport <size>     Device viewport (mobile, tablet, desktop, WIDTHxHEIGHT)
                           Default: desktop (1920x1080)
  -o, --output <path>       Screenshot output path
                           Default: ./screenshot-{timestamp}.png
  -f, --format <format>     Output format (json, text)
                           Default: text
  -w, --wait <seconds>      Wait time before screenshot
                           Default: 0
  --wait-for <selector>     Wait for specific element selector
  --no-full-page           Capture viewport only (not full page)
  --quality <number>        JPEG quality (0-100)
                           Default: 80
  --api-key <key>          Override default OpenAI API key
  --verbose               Enable debug logging
  -h, --help              Display help
  -V, --version           Show version
```

## Examples

### Basic Analysis

```bash
design-feedback https://example.com
```

Output:
```
🔍 Analyzing https://example.com (desktop viewport)
📸 Taking screenshot...
🤖 Analyzing design...

Design Feedback Report
====================

Critical Issues:
- Navigation menu items overlap on smaller desktop screens
- Form validation errors are not visually distinct
- Call-to-action buttons lack sufficient contrast

Accessibility Concerns:
- Missing alt text on hero images
- Insufficient color contrast on footer links
```

### Mobile Analysis with JSON Output

```bash
design-feedback https://example.com -v mobile -f json
```

Output:
```json
{
  "url": "https://example.com",
  "viewport": "mobile",
  "timestamp": "2024-01-15T10:30:00Z",
  "analysis": {
    "criticalIssues": [
      {
        "category": "layout",
        "severity": "high",
        "description": "Navigation menu not accessible on mobile"
      }
    ],
    "accessibilityIssues": [],
    "performanceIssues": []
  }
}
```

### Custom Screenshot with Wait

```bash
design-feedback https://example.com \
  -o ./reports/homepage.png \
  -w 2 \
  --wait-for "#content-loaded"
```

## Output Formats

### Text Format (Default)

Human-readable output with:
- Color-coded severity levels
- Clear section headers
- Bullet-pointed issues
- Actionable feedback

### JSON Format

Structured data including:
- URL and viewport metadata
- Categorized issues (critical, accessibility, performance)
- Severity levels
- Timestamps
- Detailed descriptions

## How It Works

1. **Screenshot Capture**: Uses [@alexberriman/screenshotter](https://github.com/alexberriman/screenshotter) to capture the webpage
2. **Image Processing**: Converts screenshot to base64 format
3. **AI Analysis**: Sends image to OpenAI's gpt-image-1 model with expert prompt
4. **Result Formatting**: Parses and formats the analysis based on output preference
5. **Output**: Displays results in console or saves to file

## Requirements

- Node.js 18+ or Bun runtime
- OpenAI API key with access to vision models
- Internet connection for API calls

## Contributing

Contributions are welcome! Please read our contributing guidelines and submit pull requests to our repository.

## License

MIT License - see LICENSE file for details

## Support

- **Issues**: [GitHub Issues](https://github.com/your-org/design-feedback/issues)
- **Documentation**: [Full Documentation](https://github.com/your-org/design-feedback/wiki)
- **Community**: [Discussions](https://github.com/your-org/design-feedback/discussions)

## Acknowledgments

- Built with [@alexberriman/screenshotter](https://github.com/alexberriman/screenshotter)
- Powered by OpenAI's Vision API
- Inspired by the need for automated design QA

---

Made with ❤️ for better web experiences