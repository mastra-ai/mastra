# Flash Cards Generation Template

A Mastra template that generates educational flash cards with optional images from PDF documents. Features AI-powered content analysis, question generation, and visual learning aids for effective studying and learning.

## Features

- **PDF Processing**: Extract educational content from PDF documents with intelligent parsing and automatic summarization for large files
- **Flexible Input**: Support both PDF URLs and file attachments from the playground
- **Content Analysis**: Identify key concepts, definitions, and facts suitable for flash cards
- **Flash Card Generation**: Create diverse question-answer pairs using multiple formats and difficulty levels
- **Image Generation**: Generate educational images using DALL-E 3 for visual concepts and memory aids
- **Multiple Question Types**: Definition, concept, application, comparison, true/false, and multiple choice questions
- **Difficulty Levels**: Beginner, intermediate, and advanced flash cards for progressive learning
- **Subject Area Adaptation**: Optimized for STEM, humanities, social sciences, and professional training

## Quick Start

1. **Install dependencies**:

   ```bash
   pnpm install
   ```

2. **Set up environment variables**:
   Create a `.env` file with:

   ```
   OPENAI_API_KEY=your_openai_api_key

   # For image generation (optional)
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

// Generate flash cards from a PDF URL
const result = await mastra.runWorkflow('flash-cards-generation-workflow', {
  pdfUrl: 'https://example.com/biology-textbook-chapter.pdf',
  subjectArea: 'biology',
  numberOfCards: 15,
  difficultyLevel: 'intermediate',
  questionTypes: ['definition', 'concept', 'application'],
  generateImages: true,
  imageStyle: 'educational',
  focusAreas: ['cell biology', 'metabolism', 'genetics'],
});

console.log(`Generated ${result.flashCards.length} flash cards`);
result.flashCards.forEach((card, index) => {
  console.log(`\nCard ${index + 1}:`);
  console.log(`Q: ${card.question}`);
  console.log(`A: ${card.answer}`);
  console.log(`Type: ${card.questionType} | Difficulty: ${card.difficulty}`);
  if (card.imageUrl) console.log(`Image: ${card.imageUrl}`);
});

// Generate flash cards from an attached PDF file (playground usage)
const attachedResult = await mastra.runWorkflow('flash-cards-generation-workflow', {
  pdfData:
    'data:application/pdf;base64,JVBERi0xLjQKJcfsj6IKNSAwIG9iago8PAovTGVuZ3RoIDYgMCBSCi9GaWx0ZXIgL0ZsYXRlRGVjb2RlCj4+CnN0cmVhbQ...',
  filename: 'chemistry-notes.pdf',
  subjectArea: 'chemistry',
  numberOfCards: 10,
  difficultyLevel: 'intermediate',
  generateImages: true,
  imageStyle: 'scientific',
});
```

### Generate Flash Cards for Different Subjects

```typescript
// Mathematics flash cards
const mathCards = await mastra.runWorkflow('flash-cards-generation-workflow', {
  pdfUrl: 'https://example.com/calculus-notes.pdf',
  subjectArea: 'mathematics',
  numberOfCards: 20,
  difficultyLevel: 'advanced',
  questionTypes: ['concept', 'application'],
  generateImages: true,
  imageStyle: 'diagram',
});

// History flash cards
const historyCards = await mastra.runWorkflow('flash-cards-generation-workflow', {
  pdfUrl: 'https://example.com/world-war-2-document.pdf',
  subjectArea: 'history',
  numberOfCards: 12,
  difficultyLevel: 'beginner',
  questionTypes: ['definition', 'true-false'],
  generateImages: false,
  focusAreas: ['dates', 'key figures', 'major events'],
});
```

### Using in the Playground with File Attachments

The template seamlessly integrates with the Mastra playground's file attachment feature. Users can:

1. **Attach PDF files directly** in the playground interface
2. **Ask natural language questions** about generating flash cards
3. **Receive structured flash card output** with optional images

**Example playground interaction:**

```
User: "Create flash cards from this PDF about biology, focusing on cell structure"
[attaches biology-textbook.pdf]

Agent: "I'll create educational flash cards from your PDF focusing on cell structure..."
[Processes the attached PDF and generates structured flash cards]
```

The agent automatically detects the file attachment and processes it using the workflow, extracting the base64 data and filename from the playground's message format.

### Using Individual Agents

```typescript
// Generate flash cards directly with the main agent
const flashCards = await mastra.getAgent('flashCardsAgent').generate([
  {
    role: 'user',
    content:
      'Create flash cards from this PDF about organic chemistry: https://example.com/organic-chem.pdf. Focus on reaction mechanisms and include visual diagrams.',
  },
]);

// Extract content from PDF only
const pdfContent = await mastra.getTool('pdf-content-extractor').execute({
  context: {
    pdfUrl: 'https://example.com/research-paper.pdf',
    subjectArea: 'computer science',
    focusAreas: ['algorithms', 'data structures'],
  },
  mastra,
});
```

## Components

### Agents

1. **Flash Cards Agent** - Main orchestrator that coordinates the entire flash card generation process
2. **PDF Summarization Agent** - Specialized agent for creating educational summaries from large PDF content
3. **Content Analyzer Agent** - Analyzes educational content to identify key learning elements
4. **Flash Cards Generator Agent** - Creates effective question-answer pairs using learning science principles
5. **PDF Content Agent** - Specialized PDF processing for educational content extraction

### Tools

1. **PDF Content Extractor** - Downloads and extracts structured educational content from PDFs
2. **Content Analyzer** - Identifies concepts, definitions, facts, and relationships suitable for flash cards
3. **Flash Cards Generator** - Creates diverse question-answer pairs with multiple formats and difficulty levels
4. **Educational Image Generator** - Generates visual aids using DALL-E 3 for enhanced learning

### Workflows

**Flash Cards Generation Workflow**: Complete end-to-end process that:

1. Extracts educational content from PDF documents
2. Analyzes content for key learning elements and concepts
3. Generates diverse flash cards with questions and answers
4. Creates educational images for visual concepts (optional)

## Question Types

The template supports multiple question formats:

- **Definition**: "What is photosynthesis?" → "The process by which plants convert light energy into chemical energy"
- **Concept**: "Explain the concept of natural selection" → Comprehensive explanation with examples
- **Application**: "When would you use the quadratic formula?" → Practical usage scenarios
- **Comparison**: "What's the difference between mitosis and meiosis?" → Detailed comparison
- **True/False**: "The speed of light is constant in all reference frames: True or False?" → With explanation
- **Multiple Choice**: Complex topics with plausible alternatives and explanations

## Difficulty Levels

- **Beginner**: Basic facts, simple definitions, fundamental concepts
- **Intermediate**: Applications, relationships, moderate complexity concepts
- **Advanced**: Complex applications, synthesis, critical analysis, expert-level content

## Subject Area Support

The template adapts to different academic disciplines:

- **STEM Fields**: Emphasizes formulas, processes, problem-solving methods, diagrams
- **Humanities**: Focuses on concepts, interpretations, historical context, critical thinking
- **Social Sciences**: Highlights theories, research findings, methodologies, case studies
- **Languages**: Prioritizes vocabulary, grammar rules, cultural context, usage examples

## Output Structure

```typescript
{
  flashCards: [
    {
      question: "What is cellular respiration?",
      answer: "The metabolic process by which cells break down glucose to produce ATP energy",
      questionType: "definition",
      difficulty: "intermediate",
      category: "biology",
      tags: ["metabolism", "cellular-respiration", "ATP"],
      hint: "Think about how cells generate energy",
      explanation: "This process occurs in three stages: glycolysis, Krebs cycle, and electron transport chain",
      imageUrl: "https://bucket.s3.amazonaws.com/flashcard-images/cellular-respiration.jpg"
    }
  ],
  metadata: {
    totalCards: 15,
    cardsByDifficulty: {
      beginner: 5,
      intermediate: 8,
      advanced: 2
    },
    cardsByType: {
      definition: 6,
      concept: 5,
      application: 4
    },
    subjectArea: "biology",
    sourceInfo: {
      pdfUrl: "https://example.com/biology.pdf", // or null if file attachment
      filename: "biology-textbook.pdf", // or null if URL
      inputType: "url", // or "attachment"
      fileSize: 2048576,
      pagesCount: 25,
      characterCount: 45000
    },
    generatedAt: "2024-01-15T10:30:00Z"
  }
}
```

## Configuration Options

### Input Parameters

#### PDF Input (choose one):

- `pdfUrl`: URL to the PDF document to process
- `pdfData`: Base64 encoded PDF data from file attachment
- `filename`: Filename of the attached PDF (when using pdfData)

#### Generation Options:

- `subjectArea`: Subject context (biology, mathematics, history, etc.)
- `numberOfCards`: Number of flash cards to generate (1-50)
- `difficultyLevel`: Target difficulty (beginner, intermediate, advanced)
- `questionTypes`: Array of preferred question types
- `generateImages`: Whether to create educational images
- `imageStyle`: Style for generated images (educational, diagram, illustration, etc.)
- `focusAreas`: Specific topics to emphasize

### Image Generation

When `generateImages` is enabled, the template generates educational visuals for:

- Complex scientific processes and biological structures
- Mathematical concepts, formulas, and geometric shapes
- Historical events, geographical features, and cultural concepts
- Abstract concepts that benefit from visual representation
- Diagrams and memory aids for better retention

## Environment Variables

### Required

- `OPENAI_API_KEY`: Required for AI-powered content analysis and flash card generation

### Optional (for image generation)

- `AWS_REGION`: AWS region (default: 'us-east-1')
- `AWS_ACCESS_KEY_ID`: AWS access key ID
- `AWS_SECRET_ACCESS_KEY`: AWS secret access key
- `S3_BUCKET_NAME`: S3 bucket name for storing generated images
- `S3_PUBLIC_URL_BASE`: Public URL base for accessing uploaded images

### AWS S3 Setup Example

```env
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_aws_access_key_id
AWS_SECRET_ACCESS_KEY=your_aws_secret_access_key
S3_BUCKET_NAME=mastra-flashcard-images
S3_PUBLIC_URL_BASE=https://mastra-flashcard-images.s3.amazonaws.com
```

**Note**: Configure your S3 bucket for public read access so generated images are accessible via public URLs.

## PDF Content Management

The template includes intelligent content management for PDFs of any size:

### Automatic Summarization

- **Educational Focus**: Uses a specialized PDF summarization agent trained for educational content
- **Large Context Window**: Leverages GPT-4's large context window to handle extensive documents
- **Content Preservation**: Maintains all educational concepts, definitions, and facts while reducing verbosity
- **Flash Card Optimization**: Structures summaries specifically for effective flash card generation

### Processing Strategy

1. **Text Extraction**: Extract complete text content from PDF documents
2. **Educational Summarization**: Specialized agent creates comprehensive educational summary
3. **Content Analysis**: Analyze summarized content for flash card suitable elements
4. **Flash Card Generation**: Create diverse questions from analyzed educational content

### Benefits

- **Scalable Processing**: Handle PDFs of any size using advanced AI summarization
- **Educational Quality**: Preserves all learning-relevant content while improving manageability
- **Simplified Architecture**: Clean, maintainable approach without complex chunking logic
- **Optimized Output**: Summaries structured specifically for educational flash card creation

## Development

To modify or extend this template:

1. **Add new question types**: Update the question type enums and generation logic
2. **Customize content analysis**: Modify the content analyzer for domain-specific extraction
3. **Create new image styles**: Extend the image generation tool with additional styles
4. **Add new workflows**: Combine tools and agents for specialized use cases

## Best Practices

### For Effective Flash Cards

1. **Active Recall**: Questions require retrieving information from memory
2. **Spaced Repetition**: Cards designed for spaced repetition systems
3. **Progressive Difficulty**: Include beginner to advanced levels
4. **Clear Questions**: Unambiguous and focused on one concept
5. **Complete Answers**: Comprehensive but not overwhelming

### For PDF Processing

1. **Quality PDFs**: Use text-based PDFs rather than scanned images
2. **Subject Context**: Provide subject area for better content analysis and summarization
3. **Focus Areas**: Specify key topics to emphasize important content during summarization
4. **Large File Handling**: The template automatically summarizes large PDFs using advanced AI
5. **Content Preservation**: Educational summarization preserves all learning-relevant information
6. **Optimized Processing**: Leverages large context windows for efficient, high-quality processing

## Dependencies

- `@mastra/core`: Core Mastra framework
- `@ai-sdk/openai`: OpenAI integration for content analysis and generation
- `@aws-sdk/client-s3`: S3 cloud storage for educational images
- `ai`: AI SDK for DALL-E 3 image generation
- `pdf2json`: PDF text extraction and parsing
- `zod`: Schema validation and type safety

## License

This template is part of the Mastra framework and follows the same licensing terms.
