import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

export const contentAnalyzerTool = createTool({
  id: 'content-analyzer',
  description:
    'Analyzes educational content to identify key concepts, definitions, and facts suitable for flash card generation',
  inputSchema: z.object({
    content: z.string().describe('Educational content to analyze'),
    subjectArea: z.string().optional().describe('Subject area (e.g., biology, chemistry, history, mathematics)'),
    difficultyLevel: z.enum(['beginner', 'intermediate', 'advanced']).optional().default('intermediate'),
    focusAreas: z
      .array(z.string())
      .optional()
      .describe('Specific areas to focus on (e.g., "definitions", "concepts", "formulas", "dates")'),
  }),
  outputSchema: z.object({
    concepts: z.array(
      z.object({
        concept: z.string().describe('The concept or topic'),
        explanation: z.string().describe('Clear explanation of the concept'),
        difficulty: z.enum(['beginner', 'intermediate', 'advanced']),
        keywords: z.array(z.string()).describe('Related keywords and terms'),
      }),
    ),
    definitions: z.array(
      z.object({
        term: z.string().describe('The term being defined'),
        definition: z.string().describe('Clear, concise definition'),
        context: z.string().optional().describe('Additional context or usage'),
      }),
    ),
    facts: z.array(
      z.object({
        fact: z.string().describe('Important factual information'),
        category: z.string().describe('Category of the fact (date, statistic, formula, etc.)'),
        context: z.string().optional().describe('Additional context'),
      }),
    ),
    relationships: z.array(
      z.object({
        concept1: z.string(),
        concept2: z.string(),
        relationship: z.string().describe('How the concepts are related'),
      }),
    ),
    suggestedQuestionTypes: z.array(z.string()).describe('Recommended question types for this content'),
    subjectArea: z.string().describe('Identified or confirmed subject area'),
    complexity: z.enum(['beginner', 'intermediate', 'advanced']).describe('Overall content complexity'),
  }),
  execute: async ({ context, mastra }) => {
    const { content, subjectArea, difficultyLevel, focusAreas = [] } = context;

    console.log('🔍 Analyzing content for educational concepts...');

    try {
      const contentAnalyzerAgent = mastra?.getAgent('contentAnalyzerAgent');
      if (!contentAnalyzerAgent) {
        throw new Error('Content analyzer agent not found');
      }

      const subjectAreaText = subjectArea ? `Subject area: ${subjectArea}` : '';
      const difficultyText = `Target difficulty level: ${difficultyLevel}`;
      const focusAreasText = focusAreas.length > 0 ? `Focus areas: ${focusAreas.join(', ')}` : '';

      const analysisResult = await contentAnalyzerAgent.generate([
        {
          role: 'user',
          content: `Analyze this educational content and extract elements suitable for flash card generation.

${subjectAreaText}
${difficultyText}
${focusAreasText}

Please identify and extract:
1. Key concepts with clear explanations
2. Important definitions (term-definition pairs)
3. Critical facts and information
4. Relationships between concepts
5. Suggested question types for flash cards
6. Overall subject area and complexity level

Content to analyze:
${content}

Format your response as JSON with this exact structure:
{
  "concepts": [
    {
      "concept": "string",
      "explanation": "string", 
      "difficulty": "beginner|intermediate|advanced",
      "keywords": ["keyword1", "keyword2"]
    }
  ],
  "definitions": [
    {
      "term": "string",
      "definition": "string",
      "context": "string (optional)"
    }
  ],
  "facts": [
    {
      "fact": "string",
      "category": "string",
      "context": "string (optional)"
    }
  ],
  "relationships": [
    {
      "concept1": "string",
      "concept2": "string", 
      "relationship": "string"
    }
  ],
  "suggestedQuestionTypes": ["definition", "concept", "application", "comparison", "etc"],
  "subjectArea": "string",
  "complexity": "beginner|intermediate|advanced"
}`,
        },
      ]);

      let parsedAnalysis;
      try {
        parsedAnalysis = JSON.parse(analysisResult.text || '{}');
      } catch (parseError) {
        console.error('Failed to parse analysis result, using fallback');
        parsedAnalysis = {
          concepts: [],
          definitions: [],
          facts: [],
          relationships: [],
          suggestedQuestionTypes: ['definition', 'concept'],
          subjectArea: subjectArea || 'General',
          complexity: difficultyLevel,
        };
      }

      // Validate and set defaults for required fields
      const analysis = {
        concepts: parsedAnalysis.concepts || [],
        definitions: parsedAnalysis.definitions || [],
        facts: parsedAnalysis.facts || [],
        relationships: parsedAnalysis.relationships || [],
        suggestedQuestionTypes: parsedAnalysis.suggestedQuestionTypes || ['definition', 'concept'],
        subjectArea: parsedAnalysis.subjectArea || subjectArea || 'General',
        complexity: parsedAnalysis.complexity || difficultyLevel,
      };

      console.log(
        `✅ Content analysis complete: ${analysis.concepts.length} concepts, ${analysis.definitions.length} definitions, ${analysis.facts.length} facts`,
      );

      return analysis;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Content analysis failed:', errorMessage);
      throw new Error(`Failed to analyze content: ${errorMessage}`);
    }
  },
});
