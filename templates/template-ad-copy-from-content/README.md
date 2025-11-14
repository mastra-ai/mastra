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

   # For AWS S3 cloud storage (required for image generation)
   AWS_REGION=us-east-1
   AWS_ACCESS_KEY_ID=your_aws_access_key_id
   AWS_SECRET_ACCESS_KEY=your_aws_secret_access_key
   S3_BUCKET_NAME=mastra-generated-images
   S3_PUBLIC_URL_BASE=https://your-bucket-name.s3.amazonaws.com
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

**Ad Copy Generation Workflow**: Simplified end-to-end process that:

1. Extracts content (from PDF, website URL, or text)
2. Generates optimized ad copy (headline, body, CTA)
3. Creates a promotional image and uploads to S3

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

### Ad Copy

- Single optimized headline
- Compelling body copy
- Effective call-to-action

### Image

- One promotional image uploaded to S3
- Platform-optimized dimensions
- Style-consistent visual design

## Advanced Configuration

### Expected Output Structure

```typescript
const result = await mastra.runWorkflow('ad-copy-generation-workflow', {
  // ... input params
});

// Result structure:
{
  adCopy: {
    headline: "Your optimized headline",
    body: "Compelling body copy for your ad",
    cta: "Call to action"
  },
  imageUrl: "https://your-bucket.s3.amazonaws.com/generated-images/uuid.jpg" // Optional
}
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

### AWS S3 Cloud Storage (required for image generation)

- `AWS_REGION`: AWS region (default: 'us-east-1')
- `AWS_ACCESS_KEY_ID`: AWS access key ID
- `AWS_SECRET_ACCESS_KEY`: AWS secret access key
- `S3_BUCKET_NAME`: S3 bucket name for storing generated images (default: 'mastra-generated-images')
- `S3_PUBLIC_URL_BASE`: Public URL base for accessing uploaded images

### AWS S3 Setup Example

```env
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_aws_access_key_id
AWS_SECRET_ACCESS_KEY=your_aws_secret_access_key
S3_BUCKET_NAME=mastra-generated-images
S3_PUBLIC_URL_BASE=https://mastra-generated-images.s3.amazonaws.com
```

**Note**: Make sure your S3 bucket is configured for public read access for the generated images to be accessible via the public URLs.

## Dependencies

- `@mastra/core`: Core Mastra framework
- `@ai-sdk/openai`: OpenAI integration for image generation
- `@aws-sdk/client-s3`: S3-compatible cloud storage (for image uploads)
- `@browserbasehq/stagehand`: Web browsing and content extraction
- `pdf2json`: PDF text extraction
- `ai`: AI SDK for image generation
- `zod`: Schema validation
