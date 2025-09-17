# Flash Cards from PDF Template

A simple Mastra template that generates educational flash cards from PDF documents. This template demonstrates how to extract content from PDFs, analyze it, and create question-answer pairs for studying.

## Features

- **PDF Processing**: Extract educational content from PDF documents (URL or file upload)
- **Flash Card Generation**: Create simple question-answer pairs from the content
- **Optional Images**: Generate educational images for visual learning (first 3 cards)
- **Simple Structure**: Easy to understand and extend

## Quick Start

1. **Install dependencies**:

   ```bash
   pnpm install
   ```

2. **Set up environment variables**:
   Create a `.env` file with:

   ```
   OPENAI_API_KEY=your_openai_api_key

   # Optional - for image generation
   AWS_REGION=us-east-1
   AWS_ACCESS_KEY_ID=your_aws_access_key
   AWS_SECRET_ACCESS_KEY=your_aws_secret_access_key
   S3_BUCKET_NAME=your-bucket-name
   S3_PUBLIC_URL_BASE=https://your-bucket.s3.amazonaws.com
   ```

3. **Run the application**:
   ```bash
   pnpm dev
   ```

## Usage

### Basic Example

```typescript
import { mastra } from './src/mastra';

// Generate flash cards from a PDF URL
const result = await mastra.runWorkflow('flash-cards-generation-workflow', {
  pdfUrl: 'https://example.com/document.pdf',
  numberOfCards: 10,
  generateImages: false,
});

console.log(`Generated ${result.totalCards} flash cards`);
result.flashCards.forEach(card => {
  console.log(`Q: ${card.question}`);
  console.log(`A: ${card.answer}`);
  console.log(`Difficulty: ${card.difficulty}\n`);
});
```

### With File Upload

```typescript
// Generate from uploaded PDF (base64 encoded)
const result = await mastra.runWorkflow('flash-cards-generation-workflow', {
  pdfData: 'data:application/pdf;base64,JVBERi0xLjQK...',
  filename: 'my-notes.pdf',
  numberOfCards: 15,
  generateImages: true, // Will generate images for first 3 cards
});
```

## Components

### Workflow

The main workflow (`flash-cards-generation-workflow`) has three steps:

1. **Extract PDF Content** - Gets text from the PDF and identifies key concepts
2. **Generate Flash Cards** - Creates question-answer pairs from the content
3. **Add Images** (optional) - Generates educational images for visual learning

### Tools

- **PDF Content Extractor** - Extracts and analyzes PDF content
- **Flash Card Generator** - Creates question-answer pairs
- **Educational Image Tool** - Generates images using DALL-E

### Agents

- **Flash Card Creator** - Main agent for orchestrating the process
- **PDF Processor** - Processes PDF content for educational use
- **Content Analyzer** - Analyzes content for key learning points
- **Educational Image Creator** - Creates visual learning aids

## Input Parameters

```typescript
{
  // PDF source (one required)
  pdfUrl?: string;        // URL to PDF file
  pdfData?: string;       // Base64 encoded PDF data
  filename?: string;      // Filename when using pdfData

  // Options
  numberOfCards: number;  // 5-30 cards (default: 10)
  generateImages: boolean; // Generate images (default: false)
}
```

## Output Structure

```typescript
{
  flashCards: [
    {
      question: string;     // The question
      answer: string;       // The answer
      category: string;     // Subject area
      difficulty: 'easy' | 'medium' | 'hard';
      imageUrl?: string;    // Optional image URL
    }
  ],
  totalCards: number;
  subjectArea: string;
  sourceInfo: {
    pdfUrl?: string;
    filename?: string;
    pagesCount: number;
  }
}
```

## Flash Card Types

The template generates three types of cards:

1. **Definition Cards** - "What is X?" questions
2. **Concept Cards** - "Explain Y" questions
3. **Fact Cards** - Questions about specific facts

Cards are distributed across three difficulty levels:

- **Easy** - Basic definitions and facts
- **Medium** - Concept explanations
- **Hard** - More complex concepts

## Extending the Template

This template is designed to be simple and easy to modify:

### Add More Question Types

Edit `src/mastra/tools/flash-card-generator-tool.ts` to add new question formats:

```typescript
// Add a new question type
flashCards.push({
  question: `Why is ${concept.concept} important?`,
  answer: concept.explanation,
  category: subjectArea,
  difficulty: 'medium',
});
```

### Customize Image Generation

Modify `src/mastra/workflows/flash-cards-generation-workflow.ts` to change which cards get images:

```typescript
// Currently generates for first 3 cards
if (i < 3 && generateImages) {
  // Change to generate for all cards
  if (generateImages) {
    // Generate image...
  }
}
```

### Add New Analysis

Extend the content analyzer in `src/mastra/tools/content-analyzer-tool.ts` to extract additional information from PDFs.

## Environment Setup

### Required

- `OPENAI_API_KEY` - For AI content analysis and generation

### Optional (for images)

- AWS S3 credentials for storing generated images
- Configure bucket for public read access

## Development

```bash
# Install dependencies
pnpm install

# Run development server
pnpm dev

# Build for production
pnpm build

# Start production server
pnpm start
```

## Notes

- The template processes PDFs by extracting text, so scanned image PDFs may not work well
- Image generation is limited to 3 cards by default to manage costs
- Flash cards are kept simple - just question, answer, and basic metadata
- The template is designed as a learning example, not a production-ready product
