import { createWorkflow, createStep, mapVariable } from '@mastra/core/workflows';
import { z } from 'zod';
import { RuntimeContext } from '@mastra/core/di';
import { pdfContentExtractorTool } from '../tools/pdf-content-extractor-tool';
import { contentAnalyzerTool } from '../tools/content-analyzer-tool';
import { flashCardsGeneratorTool } from '../tools/flash-cards-generator-tool';
import { imageGeneratorTool } from '../tools/image-generator-tool';

const inputSchema = z
  .object({
    // Support both PDF URL and file attachment
    pdfUrl: z.string().optional().describe('URL to the PDF file to process'),
    pdfData: z.string().optional().describe('Base64 encoded PDF data from file attachment'),
    filename: z.string().optional().describe('Filename of the attached PDF (if using pdfData)'),

    subjectArea: z.string().optional().describe('Subject area (e.g., biology, chemistry, history, mathematics)'),
    numberOfCards: z.number().min(1).max(50).optional().default(10).describe('Number of flash cards to generate'),
    difficultyLevel: z
      .enum(['beginner', 'intermediate', 'advanced'])
      .optional()
      .default('intermediate')
      .describe('Target difficulty level'),
    questionTypes: z
      .array(z.string())
      .optional()
      .default(['definition', 'concept', 'application'])
      .describe('Types of questions to generate'),
    generateImages: z.boolean().optional().default(false).describe('Whether to generate educational images'),
    imageStyle: z
      .enum(['educational', 'diagram', 'illustration', 'realistic', 'minimalist', 'scientific'])
      .optional()
      .default('educational')
      .describe('Style for generated images'),
    focusAreas: z
      .array(z.string())
      .optional()
      .describe('Specific areas to focus on (e.g., "definitions", "concepts", "formulas")'),
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
      questionType: z.string(),
      difficulty: z.string(),
      category: z.string(),
      tags: z.array(z.string()),
      hint: z.string().optional(),
      explanation: z.string().optional(),
      imageUrl: z.string().optional(),
    }),
  ),
  metadata: z.object({
    totalCards: z.number(),
    cardsByDifficulty: z.object({
      beginner: z.number(),
      intermediate: z.number(),
      advanced: z.number(),
    }),
    cardsByType: z.record(z.number()),
    subjectArea: z.string(),
    sourceInfo: z.object({
      pdfUrl: z.string().optional(),
      filename: z.string().optional(),
      inputType: z.enum(['url', 'attachment']),
      fileSize: z.number(),
      pagesCount: z.number(),
      characterCount: z.number(),
    }),
    generatedAt: z.string(),
  }),
});

// Step 1: Extract educational content from PDF
const extractPdfContentStep = createStep({
  id: 'extract-pdf-content',
  description: 'Extract and analyze educational content from PDF document',
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
    subjectArea: z.string().optional(),
    fileSize: z.number(),
    pagesCount: z.number(),
    characterCount: z.number(),
    inputType: z.enum(['url', 'attachment']),
    filename: z.string().optional(),
  }),
  execute: async ({ inputData, runtimeContext, mastra }) => {
    const { pdfUrl, pdfData, filename, subjectArea, focusAreas } = inputData;

    const inputType = pdfData ? 'attachment' : 'url';
    const source = pdfData ? filename || 'attached file' : pdfUrl;

    console.log(`📄 Extracting educational content from PDF ${inputType}: ${source}`);

    try {
      const extractionResult = await pdfContentExtractorTool.execute({
        mastra,
        context: {
          pdfUrl,
          pdfData,
          filename,
          subjectArea,
          focusAreas,
        },
        runtimeContext: runtimeContext || new RuntimeContext(),
      });

      console.log(
        `✅ Extracted content: ${extractionResult.keyTopics.length} topics, ${extractionResult.definitions.length} definitions, ${extractionResult.concepts.length} concepts`,
      );

      return {
        ...extractionResult,
        inputType,
        filename,
      };
    } catch (error) {
      console.error('❌ PDF content extraction failed:', error);
      throw new Error(
        `Failed to extract content from PDF: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  },
});

// Step 2: Analyze content for flash card suitability
const analyzeContentStep = createStep({
  id: 'analyze-content',
  description: 'Analyze educational content to identify elements suitable for flash cards',
  inputSchema: z.object({
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
    subjectArea: z.string().optional(),
    difficultyLevel: z.enum(['beginner', 'intermediate', 'advanced']),
    focusAreas: z.array(z.string()).optional(),
  }),
  outputSchema: z.object({
    analyzedConcepts: z.array(
      z.object({
        concept: z.string(),
        explanation: z.string(),
        difficulty: z.enum(['beginner', 'intermediate', 'advanced']),
        keywords: z.array(z.string()),
      }),
    ),
    analyzedDefinitions: z.array(
      z.object({
        term: z.string(),
        definition: z.string(),
        context: z.string().optional(),
      }),
    ),
    analyzedFacts: z.array(
      z.object({
        fact: z.string(),
        category: z.string(),
        context: z.string().optional(),
      }),
    ),
    suggestedQuestionTypes: z.array(z.string()),
    finalSubjectArea: z.string(),
  }),
  execute: async ({ inputData, runtimeContext, mastra }) => {
    const { educationalSummary, keyTopics, definitions, concepts, facts, subjectArea, difficultyLevel, focusAreas } =
      inputData;

    console.log('🔍 Analyzing content for flash card generation...');

    try {
      const analysisResult = await contentAnalyzerTool.execute({
        mastra,
        context: {
          content: educationalSummary,
          subjectArea,
          difficultyLevel,
          focusAreas,
        },
        runtimeContext: runtimeContext || new RuntimeContext(),
      });

      console.log(`✅ Content analysis complete: ${analysisResult.concepts.length} concepts analyzed`);

      return {
        analyzedConcepts: analysisResult.concepts,
        analyzedDefinitions: analysisResult.definitions,
        analyzedFacts: analysisResult.facts,
        suggestedQuestionTypes: analysisResult.suggestedQuestionTypes,
        finalSubjectArea: analysisResult.subjectArea,
      };
    } catch (error) {
      console.error('❌ Content analysis failed:', error);

      // Fallback analysis using original extracted content
      return {
        analyzedConcepts: concepts.map(c => ({
          concept: c.concept,
          explanation: c.explanation,
          difficulty: difficultyLevel,
          keywords: [c.concept],
        })),
        analyzedDefinitions: definitions,
        analyzedFacts: facts.map(f => ({
          fact: f,
          category: 'general',
          context: undefined,
        })),
        suggestedQuestionTypes: ['definition', 'concept'],
        finalSubjectArea: subjectArea || 'General',
      };
    }
  },
});

// Step 3: Generate flash cards
const generateFlashCardsStep = createStep({
  id: 'generate-flash-cards',
  description: 'Generate educational flash cards from analyzed content',
  inputSchema: z.object({
    analyzedConcepts: z.array(
      z.object({
        concept: z.string(),
        explanation: z.string(),
        difficulty: z.enum(['beginner', 'intermediate', 'advanced']),
        keywords: z.array(z.string()),
      }),
    ),
    analyzedDefinitions: z.array(
      z.object({
        term: z.string(),
        definition: z.string(),
        context: z.string().optional(),
      }),
    ),
    analyzedFacts: z.array(
      z.object({
        fact: z.string(),
        category: z.string(),
        context: z.string().optional(),
      }),
    ),
    suggestedQuestionTypes: z.array(z.string()),
    finalSubjectArea: z.string(),
    numberOfCards: z.number(),
    difficultyLevel: z.enum(['beginner', 'intermediate', 'advanced']),
    questionTypes: z.array(z.string()),
  }),
  outputSchema: z.object({
    flashCards: z.array(
      z.object({
        question: z.string(),
        answer: z.string(),
        questionType: z.string(),
        difficulty: z.string(),
        category: z.string(),
        tags: z.array(z.string()),
        hint: z.string().optional(),
        explanation: z.string().optional(),
      }),
    ),
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
  execute: async ({ inputData, runtimeContext, mastra }) => {
    const {
      analyzedConcepts,
      analyzedDefinitions,
      analyzedFacts,
      suggestedQuestionTypes,
      finalSubjectArea,
      numberOfCards,
      difficultyLevel,
      questionTypes,
    } = inputData;

    console.log(`🃏 Generating ${numberOfCards} flash cards...`);

    try {
      const generationResult = await flashCardsGeneratorTool.execute({
        mastra,
        context: {
          concepts: analyzedConcepts,
          definitions: analyzedDefinitions,
          facts: analyzedFacts,
          numberOfCards,
          difficultyLevel,
          questionTypes: questionTypes.length > 0 ? questionTypes : suggestedQuestionTypes,
          subjectArea: finalSubjectArea,
        },
        runtimeContext: runtimeContext || new RuntimeContext(),
      });

      console.log(`✅ Generated ${generationResult.flashCards.length} flash cards successfully`);

      return generationResult;
    } catch (error) {
      console.error('❌ Flash cards generation failed:', error);
      throw new Error(`Failed to generate flash cards: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },
});

// Step 4: Generate images for flash cards (optional)
const generateImagesStep = createStep({
  id: 'generate-images',
  description: 'Generate educational images for flash cards that would benefit from visual aids',
  inputSchema: z.object({
    flashCards: z.array(
      z.object({
        question: z.string(),
        answer: z.string(),
        questionType: z.string(),
        difficulty: z.string(),
        category: z.string(),
        tags: z.array(z.string()),
        hint: z.string().optional(),
        explanation: z.string().optional(),
      }),
    ),
    generateImages: z.boolean(),
    imageStyle: z.enum(['educational', 'diagram', 'illustration', 'realistic', 'minimalist', 'scientific']),
    subjectArea: z.string(),
  }),
  outputSchema: z.object({
    flashCardsWithImages: z.array(
      z.object({
        question: z.string(),
        answer: z.string(),
        questionType: z.string(),
        difficulty: z.string(),
        category: z.string(),
        tags: z.array(z.string()),
        hint: z.string().optional(),
        explanation: z.string().optional(),
        imageUrl: z.string().optional(),
      }),
    ),
  }),
  execute: async ({ inputData, runtimeContext, mastra }) => {
    const { flashCards, generateImages, imageStyle, subjectArea } = inputData;

    if (!generateImages) {
      console.log('⏭️ Skipping image generation as requested...');
      return {
        flashCardsWithImages: flashCards.map(card => ({ ...card, imageUrl: undefined })),
      };
    }

    console.log('🎨 Generating educational images for applicable flash cards...');

    try {
      const flashCardsWithImages = [];

      for (const card of flashCards) {
        let imageUrl;

        // Generate images for cards that would benefit from visual aids
        const shouldGenerateImage =
          card.questionType === 'concept' ||
          card.tags.some(tag =>
            ['diagram', 'process', 'structure', 'anatomy', 'geography'].includes(tag.toLowerCase()),
          ) ||
          card.category.toLowerCase().includes('biology') ||
          card.category.toLowerCase().includes('chemistry') ||
          card.category.toLowerCase().includes('physics');

        if (shouldGenerateImage) {
          try {
            const imageResult = await imageGeneratorTool.execute({
              mastra,
              context: {
                concept: `${card.question} - ${card.answer}`,
                subjectArea,
                style: imageStyle,
                complexity: card.difficulty,
              },
              runtimeContext: runtimeContext || new RuntimeContext(),
            });

            imageUrl = imageResult.imageUrl;
            console.log(`✅ Generated image for: ${card.question.substring(0, 50)}...`);
          } catch (imageError) {
            console.warn(`⚠️ Failed to generate image for card: ${imageError}`);
            imageUrl = undefined;
          }
        }

        flashCardsWithImages.push({
          ...card,
          imageUrl,
        });
      }

      const imagesGenerated = flashCardsWithImages.filter(card => card.imageUrl).length;
      console.log(`✅ Generated ${imagesGenerated} educational images`);

      return { flashCardsWithImages };
    } catch (error) {
      console.error('❌ Image generation failed:', error);

      // Return cards without images if generation fails
      return {
        flashCardsWithImages: flashCards.map(card => ({ ...card, imageUrl: undefined })),
      };
    }
  },
});

// Main workflow definition
export const flashCardsGenerationWorkflow = createWorkflow({
  id: 'flash-cards-generation-workflow',
  inputSchema,
  outputSchema,
})
  .then(extractPdfContentStep)
  .map({
    educationalSummary: {
      step: extractPdfContentStep,
      path: 'educationalSummary',
      schema: z.string(),
    },
    keyTopics: {
      step: extractPdfContentStep,
      path: 'keyTopics',
      schema: z.array(z.string()),
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
    facts: {
      step: extractPdfContentStep,
      path: 'facts',
      schema: z.array(z.string()),
    },
    subjectArea: {
      step: extractPdfContentStep,
      path: 'subjectArea',
      schema: z.string().optional(),
    },
    difficultyLevel: {
      schema: z.enum(['beginner', 'intermediate', 'advanced']),
      fn: async ({ getInitData }) => {
        const initData = getInitData();
        return initData.difficultyLevel;
      },
    },
    focusAreas: {
      schema: z.array(z.string()).optional(),
      fn: async ({ getInitData }) => {
        const initData = getInitData();
        return initData.focusAreas;
      },
    },
  })
  .then(analyzeContentStep)
  .map({
    analyzedConcepts: {
      step: analyzeContentStep,
      path: 'analyzedConcepts',
      schema: z.array(
        z.object({
          concept: z.string(),
          explanation: z.string(),
          difficulty: z.enum(['beginner', 'intermediate', 'advanced']),
          keywords: z.array(z.string()),
        }),
      ),
    },
    analyzedDefinitions: {
      step: analyzeContentStep,
      path: 'analyzedDefinitions',
      schema: z.array(
        z.object({
          term: z.string(),
          definition: z.string(),
          context: z.string().optional(),
        }),
      ),
    },
    analyzedFacts: {
      step: analyzeContentStep,
      path: 'analyzedFacts',
      schema: z.array(
        z.object({
          fact: z.string(),
          category: z.string(),
          context: z.string().optional(),
        }),
      ),
    },
    suggestedQuestionTypes: {
      step: analyzeContentStep,
      path: 'suggestedQuestionTypes',
      schema: z.array(z.string()),
    },
    finalSubjectArea: {
      step: analyzeContentStep,
      path: 'finalSubjectArea',
      schema: z.string(),
    },
    numberOfCards: {
      schema: z.number(),
      fn: async ({ getInitData }) => {
        const initData = getInitData();
        return initData.numberOfCards;
      },
    },
    difficultyLevel: {
      schema: z.enum(['beginner', 'intermediate', 'advanced']),
      fn: async ({ getInitData }) => {
        const initData = getInitData();
        return initData.difficultyLevel;
      },
    },
    questionTypes: {
      schema: z.array(z.string()),
      fn: async ({ getInitData }) => {
        const initData = getInitData();
        return initData.questionTypes;
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
          questionType: z.string(),
          difficulty: z.string(),
          category: z.string(),
          tags: z.array(z.string()),
          hint: z.string().optional(),
          explanation: z.string().optional(),
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
    imageStyle: {
      schema: z.enum(['educational', 'diagram', 'illustration', 'realistic', 'minimalist', 'scientific']),
      fn: async ({ getInitData }) => {
        const initData = getInitData();
        return initData.imageStyle;
      },
    },
    subjectArea: {
      step: analyzeContentStep,
      path: 'finalSubjectArea',
      schema: z.string(),
    },
  })
  .then(generateImagesStep)
  .map({
    flashCards: mapVariable({
      step: generateImagesStep,
      path: 'flashCardsWithImages',
    }),
    metadata: {
      schema: z.object({
        totalCards: z.number(),
        cardsByDifficulty: z.object({
          beginner: z.number(),
          intermediate: z.number(),
          advanced: z.number(),
        }),
        cardsByType: z.record(z.number()),
        subjectArea: z.string(),
        sourceInfo: z.object({
          pdfUrl: z.string().optional(),
          filename: z.string().optional(),
          inputType: z.enum(['url', 'attachment']),
          fileSize: z.number(),
          pagesCount: z.number(),
          characterCount: z.number(),
        }),
        generatedAt: z.string(),
      }),
      fn: async ({ getInitData, getStepData }) => {
        const initData = getInitData();
        const flashCardsData = getStepData(generateFlashCardsStep);
        const pdfData = getStepData(extractPdfContentStep);

        return {
          ...flashCardsData.metadata,
          sourceInfo: {
            pdfUrl: initData.pdfUrl,
            filename: pdfData.filename,
            inputType: pdfData.inputType,
            fileSize: pdfData.fileSize,
            pagesCount: pdfData.pagesCount,
            characterCount: pdfData.characterCount,
          },
        };
      },
    },
  })
  .commit();
