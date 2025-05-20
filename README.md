# Design Feedback CLI

A powerful CLI tool that captures screenshots of websites and provides professional web design/UX feedback using AI vision analysis. Perfect for quickly identifying critical design issues, errors, and UX problems in web applications.

## Features

- 🖼️ Automated website screenshot capture using [@alexberriman/screenshotter](https://github.com/alexberriman/screenshotter)
- 🤖 AI-powered design analysis using OpenAI's GPT vision models
- 📱 Support for multiple viewport sizes (mobile, tablet, desktop, custom)
- 🎨 Actionable feedback focused on critical issues and errors
- 📊 Multiple output formats (text and JSON)
- ⚡ Fast and efficient with TypeScript/Bun runtime
- 🔑 Secure API key management

## Installation

### Using npx (Recommended)

```bash
npx @alexberriman/design-feedback https://example.com
```

### Using npm

```bash
npm install -g @alexberriman/design-feedback
```

### Using Bun

```bash
bun install -g @alexberriman/design-feedback
```

### From Source

```bash
# Clone the repository
git clone https://github.com/alexberriman/openai-designer-feedback.git
cd openai-designer-feedback

# Install dependencies
bun install

# Build and link globally
bun run build
bun link
```

## Configuration

### API Key Setup

The tool requires an OpenAI API key to analyze screenshots. Set it up in one of three ways:

1. **Environment Variable** (Recommended)
   ```bash
   export OPENAI_API_KEY="your-api-key-here"
   ```

2. **Config File**
   Create `~/.design-feedback/config.json`:
   ```json
   {
     "apiKey": "your-api-key-here"
   }
   ```

3. **Command Line Option**
   ```bash
   npx @alexberriman/design-feedback https://example.com --api-key "your-api-key-here"
   ```

If no API key is configured, the tool will prompt you to enter one interactively.

## Usage

### Basic Usage

```bash
npx @alexberriman/design-feedback https://example.com
```

### Command Options

```bash
npx @alexberriman/design-feedback [options] <url>

Options:
  -v, --viewport <size>       Viewport size (mobile/tablet/desktop/WIDTHxHEIGHT) (default: "desktop")
  -o, --output <path>         Save screenshot to specified path
  -f, --format <format>       Output format (json/text) (default: "text")
  -w, --wait <seconds>        Wait time before screenshot (seconds)
  --wait-for <selector>       Wait for specific CSS selector
  --full-page                 Capture full page (default: true)
  --no-full-page              Capture viewport only
  --quality <number>          JPEG quality (0-100) (default: 90)
  --api-key <key>             Override default OpenAI API key
  --verbose                   Enable debug logging
  -h, --help                  Display help for command
```

### Usage Examples

#### Basic Website Analysis
```bash
npx @alexberriman/design-feedback https://example.com
```

#### Mobile Viewport Analysis
```bash
npx @alexberriman/design-feedback https://example.com --viewport mobile
```

#### Custom Viewport Size
```bash
npx @alexberriman/design-feedback https://example.com --viewport 1024x768
```

#### Save Screenshot with JSON Output
```bash
npx @alexberriman/design-feedback https://example.com --output screenshot.png --format json
```

#### Wait for Dynamic Content
```bash
npx @alexberriman/design-feedback https://spa-app.com --wait-for ".content-loaded" --wait 3
```

#### Save Analysis to File
```bash
npx @alexberriman/design-feedback https://example.com --format json > analysis.json
```

## Output Formats

### Text Format (Default)

The text format provides a human-readable analysis with color-coded output:

```
🔍 Design Feedback for https://example.com

📱 Viewport: desktop (1920x1080)
🕐 Analyzed at: 2024-01-15 10:30:00

Critical Issues:
• Navigation menu overlaps content on mobile devices
• Button text is not readable due to poor contrast ratio
• Form validation errors are not properly displayed
• Hero image takes too long to load (5.2s)

Accessibility Concerns:
• Missing alt text on several images
• Form inputs lack proper labels
• Color contrast fails WCAG AA standards

Performance Issues:
• Large unoptimized images (3.5MB total)
• No lazy loading implemented
• Missing viewport meta tag
```

### JSON Format

The JSON format provides structured data for programmatic use:

```json
{
  "url": "https://example.com",
  "viewport": {
    "type": "desktop",
    "width": 1920,
    "height": 1080
  },
  "timestamp": "2024-01-15T10:30:00.000Z",
  "analysis": {
    "criticalIssues": [
      {
        "severity": "high",
        "category": "layout",
        "description": "Navigation menu overlaps content on mobile devices",
        "recommendation": "Implement responsive navigation pattern"
      }
    ],
    "accessibility": [
      {
        "severity": "medium",
        "issue": "Missing alt text",
        "elements": ["hero-image", "product-gallery"]
      }
    ],
    "performance": [
      {
        "metric": "image-load-time",
        "value": "5.2s",
        "recommendation": "Optimize images and implement lazy loading"
      }
    ]
  }
}
```

## Examples

### Analyze a Production Website
```bash
npx @alexberriman/design-feedback https://mycompany.com --viewport mobile --format json > mobile-audit.json
```

### Check Responsive Design
```bash
# Check mobile view
npx @alexberriman/design-feedback https://mysite.com --viewport mobile --output mobile.png

# Check tablet view
npx @alexberriman/design-feedback https://mysite.com --viewport tablet --output tablet.png

# Check desktop view
npx @alexberriman/design-feedback https://mysite.com --viewport desktop --output desktop.png
```

### SPA with Dynamic Content
```bash
npx @alexberriman/design-feedback https://spa-app.com \
  --wait-for "[data-loaded='true']" \
  --wait 5 \
  --no-full-page
```

### CI/CD Integration
```bash
# In your CI pipeline
npx @alexberriman/design-feedback $PREVIEW_URL --format json > design-review.json

# Check for critical issues
if grep -q '"severity": "critical"' design-review.json; then
  echo "Critical design issues found!"
  exit 1
fi
```

## Troubleshooting

### Common Issues

1. **"API key not found" error**
   - Ensure your API key is properly configured
   - Check environment variables with `echo $OPENAI_API_KEY`
   - Verify config file exists at `~/.design-feedback/config.json`

2. **"Screenshot failed" error**
   - Verify the URL is accessible
   - Check your internet connection
   - Try increasing wait time with `--wait` option

3. **"Analysis timeout" error**
   - OpenAI API might be slow; try again
   - Check your API key has sufficient credits
   - Use `--verbose` for detailed error logs

### Debug Mode

Enable verbose logging for troubleshooting:

```bash
npx @alexberriman/design-feedback https://example.com --verbose
```

This will show:
- Screenshot capture progress
- API request details
- Error stack traces
- Performance timing

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

```bash
# Development setup
git clone https://github.com/alexberriman/openai-designer-feedback.git
cd openai-designer-feedback
bun install
bun test
```

For local testing during development:
```bash
# Run the local build directly
npm run build
./bin/design-feedback https://example.com
```

## License

MIT © [Alex Berriman](https://github.com/alexberriman)

## Support

- 📧 Email: alex@berriman.dev
- 🐛 Issues: [GitHub Issues](https://github.com/alexberriman/openai-designer-feedback/issues)
- 💬 Discussions: [GitHub Discussions](https://github.com/alexberriman/openai-designer-feedback/discussions)

## Acknowledgments

Built with:
- [Bun](https://bun.sh/) - Fast JavaScript runtime
- [@alexberriman/screenshotter](https://github.com/alexberriman/screenshotter) - Screenshot capture
- [OpenAI](https://openai.com/) - AI vision analysis
- [Commander.js](https://github.com/tj/commander.js/) - CLI framework
- [ts-results](https://github.com/vultix/ts-results) - Functional error handling