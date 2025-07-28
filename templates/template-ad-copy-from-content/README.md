# Ad Copy Generation Template

A Mastra template that generates compelling ad copy and promotional images from content provided as plain text, PDF links, or website URLs. Features AI-powered copywriting with web content extraction and image generation capabilities.

## Features

- **Content Processing**: Extract and analyze content from PDFs, plain text, or website URLs
- **Web Content Extraction**: Extract blog posts and articles from websites using AI-powered web browsing
- **Ad Copy Generation**: Create headlines, body copy, and CTAs for multiple platforms
- **Image Generation**: Generate promotional images using DALL-E 3 via the AI package
- **Platform Optimization**: Tailored content for Facebook, Instagram, Google Ads, LinkedIn, and more
- **A/B Testing**: Multiple variations for testing and optimization

## Quick Start

1. **Install dependencies**:

   ```bash
   pnpm install
   ```

2. **Set up environment variables**:
   Create a `.env` file with:

   ```
   OPENAI_API_KEY=your_openai_api_key

   # For web content extraction (optional - only needed for URL input type)
   BROWSERBASE_API_KEY=your_browserbase_api_key
   BROWSERBASE_PROJECT_ID=your_browserbase_project_id

   # For cloud storage (required for image generation)
   S3_REGION=auto
   S3_ENDPOINT=https://your-cloudflare-r2-endpoint.com
   S3_ACCESS_KEY_ID=your_access_key_id
   S3_SECRET_ACCESS_KEY=your_secret_access_key
   S3_BUCKET_NAME=mastra-generated-images
   S3_PUBLIC_URL_BASE=https://your-public-domain.com
   ```

3. **Run the application**:
   ```bash
   pnpm dev
   ```

## Usage Examples

### Using the Workflow

```typescript
import { mastra } from './src/mastra';

// Generate ad copy from text content
const result = await mastra.runWorkflow('ad-copy-generation-workflow', {
  contentInput: 'Your product description or marketing content here...',
  inputType: 'text',
  platform: 'facebook',
  campaignType: 'conversion',
  targetAudience: 'Small business owners aged 25-45',
  tone: 'professional',
  generateImages: true,
  imageStyle: 'modern',
});

// Generate ad copy from PDF
const pdfResult = await mastra.runWorkflow('ad-copy-generation-workflow', {
  contentInput: 'https://example.com/product-brochure.pdf',
  inputType: 'pdf',
  platform: 'linkedin',
  campaignType: 'awareness',
  tone: 'authoritative',
  brandColors: ['#1E3A8A', '#FFFFFF'],
});

// Generate ad copy from website URL
const urlResult = await mastra.runWorkflow('ad-copy-generation-workflow', {
  contentInput: 'https://techcrunch.com/example-startup-article',
  inputType: 'url',
  platform: 'instagram',
  campaignType: 'consideration',
  targetAudience: 'Tech enthusiasts and early adopters',
  tone: 'playful',
  generateImages: true,
  imageStyle: 'digital_art',
});
```

### Using Individual Agents

```typescript
// Generate ad copy directly
const adCopy = await mastra.getAgent('adCopyAgent').generate([
  {
    role: 'user',
    content: 'Create Facebook ad copy for a new productivity app targeting remote workers',
  },
]);

// Extract content from PDF
const pdfContent = await mastra.getTool('pdf-content-extractor').execute({
  context: { pdfUrl: 'https://example.com/whitepaper.pdf' },
  mastra,
});
```

## Components

### Agents

1. **Ad Copy Agent** - Main agent that orchestrates the ad copy generation process
2. **Content Summarizer Agent** - Creates marketing-focused summaries from content
3. **Copywriting Agent** - Expert copywriter for creating high-converting ad copy
4. **Web Content Agent** - Extracts content from websites and blog posts for ad copy generation

### Tools

1. **PDF Content Extractor** - Downloads and extracts marketing insights from PDFs
2. **Web Content Extractor** - Extracts blog posts and articles from websites using AI-powered browsing
3. **Page Navigate Tool** - Navigates to web URLs for content extraction
4. **Ad Copy Generator** - Creates multiple ad copy variations for different platforms
5. **Image Generator** - Generates promotional images using DALL-E 3

### Workflows

**Ad Copy Generation Workflow**: End-to-end process that:

1. Extracts content (from PDF, website URL, or text)
2. Generates multiple ad copy variations
3. Creates promotional images
4. Provides campaign recommendations

## Platform Support

- **Facebook/Instagram**: Optimized for social media advertising
- **Google Ads**: Search-intent focused copy
- **LinkedIn**: Professional, B2B-oriented content
- **Twitter**: Concise, trending-aware copy
- **TikTok**: Engaging, video-focused copy
- **Generic**: Platform-agnostic advertising copy

## Campaign Types

- **Awareness**: Brand awareness and reach campaigns
- **Consideration**: Lead generation and engagement
- **Conversion**: Sales and action-driven campaigns
- **Retention**: Customer retention and loyalty

## Output Examples

The workflow generates:

### Ad Copy Variations

- 5+ headline variations (short, medium, long)
- 4+ body copy variations (short, medium, long, bullets)
- 6+ call-to-action variations
- 3+ complete ad set combinations

### Images

- Platform-optimized promotional images
- Multiple style variations
- Brand-consistent visual elements

### Recommendations

- Platform-specific best practices
- A/B testing suggestions
- Performance optimization tips

## Advanced Configuration

### Custom Brand Colors

```typescript
const result = await mastra.runWorkflow('ad-copy-generation-workflow', {
  // ... other params
  brandColors: ['#FF6B6B', '#4ECDC4', '#45B7D1'],
  imageStyle: 'modern',
});
```

### Specific Focus Areas

```typescript
const result = await mastra.getTool('pdf-content-extractor').execute({
  context: {
    pdfUrl: 'https://example.com/content.pdf',
    focusAreas: ['benefits', 'pricing', 'testimonials'],
  },
  mastra,
});
```

## Development

To modify or extend this template:

1. **Add new platforms**: Update the platform enums in the schemas
2. **Customize copy styles**: Modify the copywriting agent instructions
3. **Add new image styles**: Extend the image generation tool
4. **Create new workflows**: Combine tools and agents in different ways

## Environment Variables

### Required
- `OPENAI_API_KEY`: Required for AI generation (OpenAI GPT-4)

### Optional (based on features used)
- `BROWSERBASE_API_KEY`: Required for web content extraction (BrowserBase)
- `BROWSERBASE_PROJECT_ID`: Required for web content extraction (BrowserBase)

### Cloud Storage (required for image generation)
- `S3_REGION`: AWS region or 'auto' for Cloudflare R2 (default: 'auto')
- `S3_ENDPOINT`: S3-compatible endpoint URL (e.g., Cloudflare R2 endpoint)
- `S3_ACCESS_KEY_ID`: Access key for S3-compatible service
- `S3_SECRET_ACCESS_KEY`: Secret key for S3-compatible service
- `S3_BUCKET_NAME`: Bucket name for storing generated images (default: 'mastra-generated-images')
- `S3_PUBLIC_URL_BASE`: Public URL base for accessing uploaded images

### Cloud Storage Setup Examples

#### Cloudflare R2
```env
S3_REGION=auto
S3_ENDPOINT=https://your-account-id.r2.cloudflarestorage.com
S3_ACCESS_KEY_ID=your_r2_access_key_id
S3_SECRET_ACCESS_KEY=your_r2_secret_access_key
S3_BUCKET_NAME=mastra-images
S3_PUBLIC_URL_BASE=https://your-custom-domain.com
```

#### AWS S3
```env
S3_REGION=us-east-1
S3_ENDPOINT=https://s3.amazonaws.com
S3_ACCESS_KEY_ID=your_aws_access_key_id
S3_SECRET_ACCESS_KEY=your_aws_secret_access_key
S3_BUCKET_NAME=mastra-generated-images
S3_PUBLIC_URL_BASE=https://mastra-generated-images.s3.amazonaws.com
```

## Dependencies

- `@mastra/core`: Core Mastra framework
- `@ai-sdk/openai`: OpenAI integration
- `@aws-sdk/client-s3`: S3-compatible cloud storage (for image uploads)
- `@browserbasehq/stagehand`: Web browsing and content extraction
- `pdf2json`: PDF text extraction
- `ai`: AI SDK for image generation
- `zod`: Schema validation

## License

This template is part of the Mastra framework and follows the same licensing terms.
