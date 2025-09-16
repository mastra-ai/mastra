import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

const flashCardSchema = z.object({
  question: z.string().describe('The question for the flash card'),
  answer: z.string().describe('The answer to the question'),
  category: z.string().describe('Category or topic'),
  difficulty: z.enum(['easy', 'medium', 'hard']).describe('Difficulty level'),
});

export const flashCardGeneratorTool = createTool({
  id: 'flash-card-generator',
  description: 'Generates educational flash cards from analyzed content',
  inputSchema: z.object({
    concepts: z.array(
      z.object({
        concept: z.string(),
        explanation: z.string(),
      }),
    ),
    definitions: z.array(
      z.object({
        term: z.string(),
        definition: z.string(),
      }),
    ),
    facts: z.array(z.string()),
    numberOfCards: z.number().min(5).max(30).default(10),
    subjectArea: z.string(),
  }),
  outputSchema: z.object({
    flashCards: z.array(flashCardSchema),
    totalCards: z.number(),
    subjectArea: z.string(),
  }),
  execute: async ({ context }) => {
    const { concepts, definitions, facts, numberOfCards, subjectArea } = context;

    console.log(`🃏 Generating ${numberOfCards} flash cards for ${subjectArea}...`);

    const flashCards: z.infer<typeof flashCardSchema>[] = [];

    // Generate cards from definitions
    for (const def of definitions.slice(0, Math.ceil(numberOfCards / 3))) {
      flashCards.push({
        question: `What is ${def.term}?`,
        answer: def.definition,
        category: subjectArea,
        difficulty: 'easy',
      });
    }

    // Generate cards from concepts
    for (const concept of concepts.slice(0, Math.ceil(numberOfCards / 3))) {
      flashCards.push({
        question: `Explain ${concept.concept}`,
        answer: concept.explanation,
        category: subjectArea,
        difficulty: 'medium',
      });
    }

    // Generate cards from facts
    for (const fact of facts.slice(0, Math.ceil(numberOfCards / 3))) {
      flashCards.push({
        question: `What do you know about: ${fact.substring(0, 50)}...?`,
        answer: fact,
        category: subjectArea,
        difficulty: 'easy',
      });
    }

    // Ensure we have the requested number of cards
    while (flashCards.length < numberOfCards) {
      // Add more concept cards if available
      const remainingConcepts = concepts.slice(flashCards.filter(c => c.difficulty === 'medium').length);
      if (remainingConcepts.length > 0) {
        const concept = remainingConcepts[0];
        flashCards.push({
          question: `Describe ${concept.concept}`,
          answer: concept.explanation,
          category: subjectArea,
          difficulty: 'hard',
        });
      } else {
        break;
      }
    }

    // Trim to exact number requested
    const finalCards = flashCards.slice(0, numberOfCards);

    console.log(`✅ Generated ${finalCards.length} flash cards`);

    return {
      flashCards: finalCards,
      totalCards: finalCards.length,
      subjectArea,
    };
  },
});
