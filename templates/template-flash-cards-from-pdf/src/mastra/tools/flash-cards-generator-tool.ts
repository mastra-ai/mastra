import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

const flashCardSchema = z.object({
  question: z.string().describe('The question or prompt for the flash card'),
  answer: z.string().describe('The answer or explanation'),
  questionType: z.enum([
    'definition',
    'concept',
    'application',
    'comparison',
    'true-false',
    'multiple-choice',
    'short-answer',
  ]),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']),
  category: z.string().describe('Subject category or topic area'),
  tags: z.array(z.string()).describe('Related keywords and tags'),
  hint: z.string().optional().describe('Optional hint for difficult questions'),
  explanation: z.string().optional().describe('Additional explanation or context'),
});

export const flashCardsGeneratorTool = createTool({
  id: 'flash-cards-generator',
  description: 'Generates educational flash cards with questions and answers from analyzed content',
  inputSchema: z.object({
    concepts: z.array(
      z.object({
        concept: z.string(),
        explanation: z.string(),
        difficulty: z.enum(['beginner', 'intermediate', 'advanced']),
        keywords: z.array(z.string()),
      }),
    ),
    definitions: z.array(
      z.object({
        term: z.string(),
        definition: z.string(),
        context: z.string().optional(),
      }),
    ),
    facts: z.array(
      z.object({
        fact: z.string(),
        category: z.string(),
        context: z.string().optional(),
      }),
    ),
    numberOfCards: z.number().min(1).max(50).default(10).describe('Number of flash cards to generate'),
    difficultyLevel: z.enum(['beginner', 'intermediate', 'advanced']).optional().default('intermediate'),
    questionTypes: z.array(z.string()).optional().describe('Preferred question types'),
    subjectArea: z.string().describe('Subject area for the flash cards'),
  }),
  outputSchema: z.object({
    flashCards: z.array(flashCardSchema),
    metadata: z.object({
      totalCards: z.number(),
      cardsByDifficulty: z.object({
        beginner: z.number(),
        intermediate: z.number(),
        advanced: z.number(),
      }),
      cardsByType: z.record(z.number()),
      subjectArea: z.string(),
      generatedAt: z.string(),
    }),
  }),
  execute: async ({ context, mastra }) => {
    const {
      concepts,
      definitions,
      facts,
      numberOfCards,
      difficultyLevel,
      questionTypes = ['definition', 'concept', 'application'],
      subjectArea,
    } = context;

    console.log(`🃏 Generating ${numberOfCards} flash cards for ${subjectArea}...`);

    try {
      const flashCardsGeneratorAgent = mastra?.getAgent('flashCardsGeneratorAgent');
      if (!flashCardsGeneratorAgent) {
        throw new Error('Flash cards generator agent not found');
      }

      const generationPrompt = `Generate ${numberOfCards} educational flash cards from the provided content.

Subject Area: ${subjectArea}
Target Difficulty: ${difficultyLevel}
Preferred Question Types: ${questionTypes.join(', ')}

Content Available:
- ${concepts.length} concepts
- ${definitions.length} definitions  
- ${facts.length} facts

CONCEPTS:
${concepts.map(c => `- ${c.concept}: ${c.explanation}`).join('\n')}

DEFINITIONS:
${definitions.map(d => `- ${d.term}: ${d.definition}`).join('\n')}

FACTS:
${facts.map(f => `- ${f.fact} (${f.category})`).join('\n')}

Create diverse flash cards that:
1. Cover the most important concepts and information
2. Use varied question types (${questionTypes.join(', ')})
3. Include different difficulty levels
4. Have clear, concise questions and comprehensive answers
5. Include helpful tags and categories

Format your response as JSON with this exact structure:
{
  "flashCards": [
    {
      "question": "string",
      "answer": "string", 
      "questionType": "definition|concept|application|comparison|true-false|multiple-choice|short-answer",
      "difficulty": "beginner|intermediate|advanced",
      "category": "string",
      "tags": ["tag1", "tag2"],
      "hint": "string (optional)",
      "explanation": "string (optional)"
    }
  ]
}`;

      const generationResult = await flashCardsGeneratorAgent.generate([
        {
          role: 'user',
          content: generationPrompt,
        },
      ]);

      let parsedResult;
      try {
        parsedResult = JSON.parse(generationResult.text || '{}');
      } catch (parseError) {
        console.error('Failed to parse flash cards result, creating fallback cards');

        // Create fallback flash cards from available content
        const fallbackCards = [];

        // Generate definition cards
        for (const def of definitions.slice(0, Math.min(5, numberOfCards))) {
          fallbackCards.push({
            question: `What is ${def.term}?`,
            answer: def.definition,
            questionType: 'definition',
            difficulty: difficultyLevel,
            category: subjectArea,
            tags: [def.term],
            hint: undefined,
            explanation: def.context,
          });
        }

        // Generate concept cards
        for (const concept of concepts.slice(0, Math.min(numberOfCards - fallbackCards.length, concepts.length))) {
          fallbackCards.push({
            question: `Explain the concept of ${concept.concept}`,
            answer: concept.explanation,
            questionType: 'concept',
            difficulty: concept.difficulty,
            category: subjectArea,
            tags: concept.keywords,
            hint: undefined,
            explanation: undefined,
          });
        }

        parsedResult = { flashCards: fallbackCards.slice(0, numberOfCards) };
      }

      const flashCards = parsedResult.flashCards || [];

      // Calculate metadata
      const cardsByDifficulty = {
        beginner: flashCards.filter((card: any) => card.difficulty === 'beginner').length,
        intermediate: flashCards.filter((card: any) => card.difficulty === 'intermediate').length,
        advanced: flashCards.filter((card: any) => card.difficulty === 'advanced').length,
      };

      const cardsByType: Record<string, number> = {};
      flashCards.forEach((card: any) => {
        cardsByType[card.questionType] = (cardsByType[card.questionType] || 0) + 1;
      });

      const metadata = {
        totalCards: flashCards.length,
        cardsByDifficulty,
        cardsByType,
        subjectArea,
        generatedAt: new Date().toISOString(),
      };

      console.log(`✅ Generated ${flashCards.length} flash cards successfully`);
      console.log(
        `📊 Distribution: ${cardsByDifficulty.beginner} beginner, ${cardsByDifficulty.intermediate} intermediate, ${cardsByDifficulty.advanced} advanced`,
      );

      return {
        flashCards,
        metadata,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Flash cards generation failed:', errorMessage);
      throw new Error(`Failed to generate flash cards: ${errorMessage}`);
    }
  },
});
