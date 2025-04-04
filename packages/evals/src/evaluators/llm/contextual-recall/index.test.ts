import { createOpenAI } from '@ai-sdk/openai';
import { describe, it, expect } from 'vitest';

import type { TestCase } from '../types';
import { isCloserTo } from '../utils';

import { ContextualRecall } from './index';

const testCases: TestCase[] = [
  {
    // Perfect recall - all output sentences are supported by context
    input: 'What are the health benefits of regular exercise?',
    output:
      'Regular exercise improves cardiovascular health by strengthening the heart. It helps maintain a healthy weight by burning calories. Exercise also reduces stress and improves mental health by releasing endorphins.',
    context: [
      'Regular exercise strengthens the heart muscle, improves blood circulation, and reduces the risk of heart disease, contributing to better cardiovascular health.',
      'Physical activity burns calories, which helps with weight management and prevents obesity-related health issues.',
      'Exercise triggers the release of endorphins, which are natural mood elevators that reduce stress, anxiety, and symptoms of depression.',
    ],
    expectedResult: {
      score: 1.0,
      reason:
        'The score is 1.0 because all sentences in the output are directly supported by the context. Each statement about cardiovascular health, weight management, and mental health benefits is explicitly mentioned in the corresponding context pieces.',
    },
  },
  {
    // Partial recall - some output sentences are supported, others aren't
    input: 'What are the main features of electric vehicles?',
    output:
      'Electric vehicles run on rechargeable batteries instead of gasoline. They produce zero tailpipe emissions. EVs typically have lower maintenance costs than conventional vehicles. They can travel up to 500 miles on a single charge.',
    context: [
      'Electric vehicles (EVs) are powered by rechargeable battery packs rather than internal combustion engines that use gasoline or diesel.',
      'Because they run on electricity, EVs produce zero direct tailpipe emissions, helping to reduce air pollution in urban areas.',
      `EVs generally require less maintenance than conventional vehicles because they have fewer moving parts and don't need oil changes.`,
    ],
    expectedResult: {
      score: 0.75,
      reason: `The score is 0.75 because 3 out of 4 sentences in the output are supported by the context. The statements about batteries, emissions, and maintenance costs are all directly supported, but the claim about 500-mile range isn't found in any context piece.`,
    },
  },
  {
    // Zero recall - no output sentences are supported by context
    input: 'What are the key events of World War II?',
    output: `World War II began with Germany's invasion of Poland in 1939. The United States entered the war after the attack on Pearl Harbor in 1941. The war in Europe ended with Germany's surrender in May 1945.`,
    context: [
      'The Renaissance was a period of European cultural, artistic, and scientific revival that began in Italy in the 14th century.',
      'The Industrial Revolution was a period of major industrialization that took place during the late 1700s and early 1800s.',
      'The American Civil War was fought from 1861 to 1865 between the Northern and Southern states.',
    ],
    expectedResult: {
      score: 0.0,
      reason:
        'The score is 0.0 because none of the sentences in the output are supported by the context. The context pieces discuss completely different historical periods (Renaissance, Industrial Revolution, American Civil War) with no mention of World War II or any of its key events.',
    },
  },
  {
    // Mixed recall with partial support
    input: 'How does climate change affect marine ecosystems?',
    output:
      'Climate change causes ocean warming, which can lead to coral bleaching. Rising sea levels threaten coastal habitats. Ocean acidification affects shell-forming organisms. Changing ocean currents disrupt migration patterns.',
    context: [
      'Increasing ocean temperatures due to climate change can cause coral bleaching, where corals expel their symbiotic algae and often die as a result.',
      'Ocean acidification occurs when seawater absorbs carbon dioxide from the atmosphere, making it more difficult for shell-forming marine organisms to build their calcium carbonate structures.',
      'Climate change can alter precipitation patterns, affecting the amount of freshwater runoff into coastal areas.',
    ],
    expectedResult: {
      score: 0.5,
      reason:
        'The score is 0.5 because 2 out of 4 sentences in the output are supported by the context. The statements about coral bleaching and ocean acidification are directly supported, but there is no mention of sea level rise or changing ocean currents affecting migration in the provided context.',
    },
  },
  {
    // High recall with varying levels of support
    input: 'What are the components of a computer?',
    output:
      'A computer consists of a CPU that processes instructions. It has RAM for temporary storage and a hard drive for permanent storage. A motherboard connects all components together.',
    context: [
      'The Central Processing Unit (CPU) is the primary component of a computer that performs most of the processing inside the computer.',
      'Random Access Memory (RAM) provides temporary storage for data and programs that the CPU is currently using.',
      'Storage devices like hard disk drives (HDDs) and solid-state drives (SSDs) provide permanent data storage that persists even when the computer is powered off.',
      'The motherboard is the main circuit board that connects all components and allows communication between different hardware parts of the system.',
    ],
    expectedResult: {
      score: 1.0,
      reason: `The score is 1.0 because all sentences in the output are fully supported by the context. Each component mentioned (CPU, RAM, hard drive, and motherboard) is explicitly described in the context with its function matching what's stated in the output.`,
    },
  },
];

const SECONDS = 10000;

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const model = openai('gpt-4o');

describe(
  'ContextualRecallEvaluator',
  () => {
    it('should detect perfect recall when all output sentences are supported by context', async () => {
      const testCase = testCases[0]!;
      const evaluator = new ContextualRecall({ model, context: testCase.context });
      const result = await evaluator.score({ input: testCase.input, output: testCase.output });
      expect(result.score).toBeCloseTo(testCase.expectedResult.score, 1);
    });

    it('should handle partial recall with some supported and some unsupported sentences', async () => {
      const testCase = testCases[1]!;
      const evaluator = new ContextualRecall({ model, context: testCase.context });
      const result = await evaluator.score({ input: testCase.input, output: testCase.output });
      expect(isCloserTo(result.score, testCase.expectedResult.score, 0)).toBe(true);
    });

    it('should identify zero recall with completely unsupported output', async () => {
      const testCase = testCases[2]!;
      const evaluator = new ContextualRecall({ model, context: testCase.context });
      const result = await evaluator.score({ input: testCase.input, output: testCase.output });
      expect(result.score).toBeCloseTo(testCase.expectedResult.score, 1);
    });

    it('should evaluate mixed recall with partially supported sentences', async () => {
      const testCase = testCases[3]!;
      const evaluator = new ContextualRecall({ model, context: testCase.context });
      const result = await evaluator.score({ input: testCase.input, output: testCase.output });
      expect(isCloserTo(result.score, testCase.expectedResult.score, 0.2)).toBe(true);
    });

    it('should handle high recall with varying levels of support', async () => {
      const testCase = testCases[4]!;
      const evaluator = new ContextualRecall({ model, context: testCase.context });
      const result = await evaluator.score({ input: testCase.input, output: testCase.output });
      expect(result.score).toBeCloseTo(testCase.expectedResult.score, 1);
    });
  },
  15 * SECONDS,
);
