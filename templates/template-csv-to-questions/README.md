# CSV to Questions Generator

A Mastra template that processes CSV files from URLs and generates comprehensive questions from their content using OpenAI GPT-4o.

## Overview

This template demonstrates a streamlined workflow:

1. **Input**: CSV URL
2. **Download & Parse**: Fetch and parse the CSV file
3. **Generate Questions**: Create questions using OpenAI GPT-4o with CSV-specific context

## Prerequisites

- Node.js 20.9.0 or higher
- **OpenAI API key** (required for question generation)

## Setup

1. **Install dependencies:**

   ```bash
   pnpm install
   ```

2. **Set up your OpenAI API key:**

   ```bash
   export OPENAI_API_KEY="your-openai-api-key-here"
   ```

   > **Important**: You need a valid OpenAI API key for this template to work. Get one from [OpenAI's platform](https://platform.openai.com/api-keys).

3. **Run the example:**

   ```bash
   npx tsx example.ts
   ```

## Usage

### Basic Usage

```typescript
import { mastra } from './src/mastra';

async function runCSVExample() {
  // Make sure OPENAI_API_KEY is set in your environment
  const run = await mastra.getWorkflow('csvToQuestionsWorkflow').createRunAsync();

  const result = await run.start({
    inputData: {
      csvUrl: 'https://example.com/data.csv',
    },
  });

  if (result.status === 'success' && result.result?.success) {
    console.log(result.result.questions);
  }
}
```

### Expected Output

```javascript
{
  status: 'success',
  result: {
    questions: [
      "What are the main columns in this CSV dataset?",
      "How many total entries are included in the data?",
      "Which category shows the highest values?",
      "What patterns can you identify in the data?",
      // ... more questions
    ],
    success: true
  }
}
```

## Architecture

### Components

- **`csvToQuestionsWorkflow`**: Main workflow orchestrating the process
- **`csvQuestionAgent`**: Mastra agent specialized in generating questions from CSV data (now equipped with the CSV tool)
- **`csvTool`**: CSV fetching and parsing tool with data analysis (ID: `fetch-and-parse-csv`)

### Workflow Steps

1. **`process-csv-generate-questions`**: Uses the CSV agent to fetch CSV data and generate questions in one step

## Features

- ✅ **URL-based CSV Processing**: Fetches CSV files from any public URL
- ✅ **Smart CSV Parsing**: Handles quoted fields, different delimiters, and data types
- ✅ **Data Analysis**: Provides insights about data structure, types, and patterns
- ✅ **CSV-Specific Questions**: Generates questions tailored for tabular data
- ✅ **Statistical Context**: Includes row/column counts and data type analysis
- ✅ **Structured Output**: Returns organized, educational questions

## How It Works

### Agent-Driven Processing

The CSV question agent now directly uses the CSV tool to:
1. **Download**: Fetches CSV content from provided URL
2. **Parse**: Uses custom CSV parser to handle various formats
3. **Analyze**: Determines data types, structure, and provides sample data
4. **Generate**: Creates questions directly from the analyzed data

> **Improved Architecture**: The agent now has direct access to the CSV tool, enabling better error handling, more contextual question generation, and simplified workflow orchestration.

### Question Generation

The CSV-specific agent creates questions that cover:
- **Data Structure**: Column names, data types, row/column counts
- **Statistical Analysis**: Patterns, trends, ranges, and distributions
- **Comparative Analysis**: Comparisons between different data points
- **Practical Applications**: Real-world use cases and insights

## Configuration

### Environment Variables

```bash
# Required - get from https://platform.openai.com/api-keys
OPENAI_API_KEY=your_openai_api_key_here
```

### Customization

You can customize the question generation by modifying the `csvQuestionAgent`:

```typescript
export const csvQuestionAgent = new Agent({
  name: 'CSV Question Generator',
  instructions: `
    // Customize instructions here for different question types
    // Focus on specific aspects like statistical analysis, patterns, etc.
  `,
  model: openai('gpt-4o'),
});
```

## Development

### Project Structure

```text
src/mastra/
├── agents/
│   └── csv-question-agent.ts       # CSV-specific question generation agent
├── tools/
│   └── csv-tool.ts                 # CSV fetching and parsing utility
├── workflows/
│   └── csv-to-questions-workflow.ts # Main workflow
└── index.ts                        # Mastra configuration
```

## Example CSV URLs

For testing, you can use these public CSV files:

- World GDP Data: `https://raw.githubusercontent.com/plotly/datasets/master/2014_world_gdp_with_codes.csv`
- Cities Data: `https://people.sc.fsu.edu/~jburkardt/data/csv/cities.csv`
- Sample Dataset: `https://raw.githubusercontent.com/holtzy/data_to_viz/master/Example_dataset/1_OneNum.csv`

## What Makes This Template Special

### 🎯 **CSV-Optimized Question Generation**
- Questions specifically designed for tabular data
- Covers data structure, patterns, and statistical analysis
- Includes comparative and analytical questions

### 📊 **Smart Data Analysis**
- Automatic data type detection
- Row/column analysis
- Sample data extraction for context

### 🔧 **Flexible CSV Processing**
- Handles various CSV formats and delimiters
- Supports quoted fields and mixed data types
- Robust error handling

### 🚀 **Easy Integration**
- Simple URL-based input
- Structured JSON output
- Clear workflow steps

### 🛠️ **Developer-Friendly**
- Comprehensive error handling
- Detailed debug logging
- Clear troubleshooting guide

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request
