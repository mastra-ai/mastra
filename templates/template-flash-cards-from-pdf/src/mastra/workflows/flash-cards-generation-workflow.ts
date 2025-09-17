import { RuntimeContext } from '@mastra/core/di';
import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';
import { educationalImageTool } from '../tools/educational-image-tool';
import { flashCardGeneratorTool } from '../tools/flash-card-generator-tool';
import { pdfContentExtractorTool } from '../tools/pdf-content-extractor-tool';

const inputSchema = z
  .object({
    // PDF input (URL or file attachment)
    pdfUrl: z.string().optional().describe('URL to the PDF file'),
    pdfData: z.string().optional().describe('Base64 encoded PDF data'),
    filename: z.string().optional().describe('Filename if using pdfData'),

    // Basic configuration
    numberOfCards: z.number().min(5).max(30).optional().default(10),
    generateImages: z.boolean().optional().default(false),
  })
  .refine(data => data.pdfUrl || data.pdfData, {
    message: 'Either pdfUrl or pdfData must be provided',
    path: ['pdfUrl', 'pdfData'],
  });

const outputSchema = z.object({
  flashCards: z.array(
    z.object({
      question: z.string(),
      answer: z.string(),
      category: z.string(),
      difficulty: z.enum(['easy', 'medium', 'hard']),
      imageUrl: z.string().optional(),
    }),
  ),
  totalCards: z.number(),
  subjectArea: z.string(),
  sourceInfo: z.object({
    pdfUrl: z.string().optional(),
    filename: z.string().optional(),
    pagesCount: z.number(),
  }),
});

// Step 1: Extract content from PDF
const extractPdfContentStep = createStep({
  id: 'extract-pdf-content',
  description: 'Extract educational content from PDF',
  inputSchema: inputSchema,
  outputSchema: z.object({
    educationalSummary: z.string(),
    keyTopics: z.array(z.string()),
    definitions: z.array(
      z.object({
        term: z.string(),
        definition: z.string(),
      }),
    ),
    concepts: z.array(
      z.object({
        concept: z.string(),
        explanation: z.string(),
      }),
    ),
    facts: z.array(z.string()),
    subjectArea: z.string(),
    pagesCount: z.number(),
  }),
  execute: async ({ inputData, runtimeContext, mastra }) => {
    const { pdfUrl, pdfData, filename } = inputData;

    console.log('📄 Extracting content from PDF...');

    const result = await pdfContentExtractorTool.execute({
      mastra,
      context: {
        pdfUrl,
        pdfData,
        filename,
      },
      runtimeContext: runtimeContext || new RuntimeContext(),
    });

    return {
      educationalSummary: result.educationalSummary,
      keyTopics: result.keyTopics,
      definitions: result.definitions,
      concepts: result.concepts,
      facts: result.facts,
      subjectArea: result.subjectArea || 'General',
      pagesCount: result.pagesCount,
    };
  },
});

// Step 2: Generate flash cards
const generateFlashCardsStep = createStep({
  id: 'generate-flash-cards',
  description: 'Generate flash cards from content',
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
    subjectArea: z.string(),
    numberOfCards: z.number(),
  }),
  outputSchema: z.object({
    flashCards: z.array(
      z.object({
        question: z.string(),
        answer: z.string(),
        category: z.string(),
        difficulty: z.enum(['easy', 'medium', 'hard']),
      }),
    ),
    totalCards: z.number(),
    subjectArea: z.string(),
  }),
  execute: async ({ inputData, runtimeContext, mastra }) => {
    const { concepts, definitions, facts, subjectArea, numberOfCards } = inputData;

    console.log(`🃏 Generating ${numberOfCards} flash cards...`);

    const result = await flashCardGeneratorTool.execute({
      mastra,
      context: {
        concepts,
        definitions,
        facts,
        numberOfCards,
        subjectArea,
      },
      runtimeContext: runtimeContext || new RuntimeContext(),
    });

    return result;
  },
});

// Step 3: Generate images (optional)
const generateImagesStep = createStep({
  id: 'generate-images',
  description: 'Generate images for flash cards',
  inputSchema: z.object({
    flashCards: z.array(
      z.object({
        question: z.string(),
        answer: z.string(),
        category: z.string(),
        difficulty: z.enum(['easy', 'medium', 'hard']),
      }),
    ),
    generateImages: z.boolean(),
    subjectArea: z.string(),
  }),
  outputSchema: z.object({
    flashCards: z.array(
      z.object({
        question: z.string(),
        answer: z.string(),
        category: z.string(),
        difficulty: z.enum(['easy', 'medium', 'hard']),
        imageUrl: z.string().optional(),
      }),
    ),
  }),
  execute: async ({ inputData, runtimeContext, mastra }) => {
    const { flashCards, generateImages, subjectArea } = inputData;

    if (!generateImages) {
      return { flashCards };
    }

    console.log('🎨 Generating images for flash cards...');

    const flashCardsWithImages = [];

    // Only generate images for a few cards to keep it simple
    for (let i = 0; i < flashCards.length; i++) {
      const card = flashCards[i];
      let imageUrl;

      // Generate image for the first 3 cards only
      if (i < 3 && generateImages) {
        try {
          const imageResult = await educationalImageTool.execute({
            mastra,
            context: {
              concept: `${card.question} - ${card.answer}`,
              subjectArea,
              style: 'educational',
              complexity:
                card.difficulty === 'easy' ? 'beginner' : card.difficulty === 'medium' ? 'intermediate' : 'advanced',
              size: '1024x1024',
            },
            runtimeContext: runtimeContext || new RuntimeContext(),
          });
          imageUrl = imageResult.imageUrl;
          console.log(`✅ Generated image for card ${i + 1}`);
        } catch (error) {
          console.warn(`⚠️ Failed to generate image: ${error}`);
        }
      }

      flashCardsWithImages.push({
        ...card,
        imageUrl,
      });
    }

    return { flashCards: flashCardsWithImages };
  },
});

// Main workflow
export const flashCardsGenerationWorkflow = createWorkflow({
  id: 'flash-cards-generation-workflow',
  inputSchema,
  outputSchema,
})
  .then(extractPdfContentStep)
  .map({
    concepts: {
      step: extractPdfContentStep,
      path: 'concepts',
      schema: z.array(
        z.object({
          concept: z.string(),
          explanation: z.string(),
        }),
      ),
    },
    definitions: {
      step: extractPdfContentStep,
      path: 'definitions',
      schema: z.array(
        z.object({
          term: z.string(),
          definition: z.string(),
        }),
      ),
    },
    facts: {
      step: extractPdfContentStep,
      path: 'facts',
      schema: z.array(z.string()),
    },
    subjectArea: {
      step: extractPdfContentStep,
      path: 'subjectArea',
      schema: z.string(),
    },
    numberOfCards: {
      schema: z.number(),
      fn: async ({ getInitData }) => {
        const initData = getInitData();
        return initData.numberOfCards;
      },
    },
  })
  .then(generateFlashCardsStep)
  .map({
    flashCards: {
      step: generateFlashCardsStep,
      path: 'flashCards',
      schema: z.array(
        z.object({
          question: z.string(),
          answer: z.string(),
          category: z.string(),
          difficulty: z.enum(['easy', 'medium', 'hard']),
        }),
      ),
    },
    generateImages: {
      schema: z.boolean(),
      fn: async ({ getInitData }) => {
        const initData = getInitData();
        return initData.generateImages;
      },
    },
    subjectArea: {
      step: generateFlashCardsStep,
      path: 'subjectArea',
      schema: z.string(),
    },
  })
  .then(generateImagesStep)
  .map({
    flashCards: {
      step: generateImagesStep,
      path: 'flashCards',
      schema: z.array(
        z.object({
          question: z.string(),
          answer: z.string(),
          category: z.string(),
          difficulty: z.enum(['easy', 'medium', 'hard']),
          imageUrl: z.string().optional(),
        }),
      ),
    },
    totalCards: {
      step: generateFlashCardsStep,
      path: 'totalCards',
      schema: z.number(),
    },
    subjectArea: {
      step: generateFlashCardsStep,
      path: 'subjectArea',
      schema: z.string(),
    },
    sourceInfo: {
      schema: z.object({
        pdfUrl: z.string().optional(),
        filename: z.string().optional(),
        pagesCount: z.number(),
      }),
      fn: async ({ getInitData, getStepResult }) => {
        const initData = getInitData();
        const pdfData = getStepResult(extractPdfContentStep);
        return {
          pdfUrl: initData.pdfUrl,
          filename: initData.filename,
          pagesCount: pdfData.pagesCount,
        };
      },
    },
  })
  .commit();
