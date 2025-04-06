import { createOpenAI } from '@ai-sdk/openai';
import { describe, it, expect } from 'vitest';

import type { TestCase } from '../types';
import { isCloserTo } from '../utils';

import { ContextPrecision } from './index';

const testCases: TestCase[] = [
  {
    // High precision - all context is relevant
    input: 'What is photosynthesis?',
    output:
      'Photosynthesis is the process by which plants convert sunlight into energy. It involves chlorophyll and produces oxygen as a byproduct.',
    context: [
      'Photosynthesis is the process by which plants convert light energy into chemical energy.',
      'Chlorophyll is the green pigment in plants that absorbs light energy.',
      'During photosynthesis, plants take in carbon dioxide and release oxygen.',
      'The energy produced during photosynthesis is stored as glucose.',
      'Photosynthesis occurs in the chloroplasts of plant cells.',
    ],
    expectedResult: {
      score: 1.0,
      reason:
        'The score is 1.0 because all context pieces are directly relevant to explaining photosynthesis, with information about the process, components, and outputs that match the response.',
    },
  },
  {
    // Medium precision - some context is irrelevant
    input: 'What are the main features of the Python programming language?',
    output:
      'Python is a high-level, interpreted programming language known for its readability and simple syntax. It supports multiple programming paradigms and has a large standard library.',
    context: [
      'Python is a high-level, interpreted programming language created by Guido van Rossum.',
      'Python features a dynamic type system and automatic memory management.',
      'The Python syntax is designed to be readable with significant whitespace.',
      'Python supports multiple programming paradigms, including procedural, object-oriented, and functional programming.',
      'JavaScript is a scripting language primarily used for web development.',
    ],
    expectedResult: {
      score: 0.8,
      reason:
        "The score is 0.8 because 4 out of 5 context pieces are relevant to Python's features, with only the last piece about JavaScript being irrelevant.",
    },
  },
  {
    // Low precision - many irrelevant pieces
    input: 'What is the capital of France?',
    output: 'The capital of France is Paris.',
    context: [
      'Paris is the capital and most populous city of France.',
      'Rome is the capital of Italy.',
      'Berlin is the capital of Germany.',
      'Madrid is the capital of Spain.',
      'London is the capital of the United Kingdom.',
    ],
    expectedResult: {
      score: 0.2,
      reason:
        "The score is 0.2 because only 1 out of 5 context pieces is relevant to the query about France's capital, with the rest providing information about other countries.",
    },
  },
  {
    // Mixed precision with relevant pieces scattered
    input: 'How does climate change affect polar bears?',
    output:
      'Climate change threatens polar bears by melting sea ice, which they need for hunting seals, their primary food source. This leads to longer fasting periods, reduced body condition, lower reproductive rates, and declining populations.',
    context: [
      'Polar bears rely on sea ice to hunt seals, their primary prey.',
      'Global warming is causing Arctic sea ice to melt earlier in spring and form later in fall.',
      'The Sahara Desert is the largest hot desert in the world.',
      'Longer ice-free periods force polar bears to fast for extended periods.',
      'Penguins are found in the Southern Hemisphere, primarily in Antarctica.',
    ],
    expectedResult: {
      score: 0.6,
      reason:
        'The score is 0.6 because 3 out of 5 context pieces are relevant to climate change effects on polar bears, with 2 irrelevant pieces about the Sahara Desert and penguins.',
    },
  },
  {
    // No relevant context
    input: 'What is quantum computing?',
    output:
      'Quantum computing uses quantum bits or qubits that can exist in multiple states simultaneously, unlike classical bits that are either 0 or 1. This allows quantum computers to solve certain problems much faster than classical computers.',
    context: [
      'Basketball is a team sport played with a ball and hoop.',
      'The Great Wall of China is over 13,000 miles long.',
      'Mozart composed over 600 works during his lifetime.',
      'The blue whale is the largest animal known to have existed.',
      'The Mona Lisa was painted by Leonardo da Vinci.',
    ],
    expectedResult: {
      score: 0.0,
      reason:
        'The score is 0.0 because none of the context pieces contain any information related to quantum computing.',
    },
  },
];

const SECONDS = 10000;

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const model = openai('gpt-4o');

describe(
  'ContextPrecisionEvaluator',
  () => {
    it('should be able to measure high precision context', async () => {
      const evaluator = new ContextPrecision({
        model,
        scale: 1,
        context: testCases[0].context || [],
      });
      const result = await evaluator.score({ input: testCases[0].input, output: testCases[0].output });
      expect(result.score).toBeCloseTo(testCases[0].expectedResult.score, 1);
    });

    it('should be able to measure medium precision context', async () => {
      const evaluator = new ContextPrecision({
        model,
        scale: 1,
        context: testCases[1].context || [],
      });
      const result = await evaluator.score({ input: testCases[1].input, output: testCases[1].output });
      expect(isCloserTo(result.score, testCases[1].expectedResult.score, 0)).toBe(true);
    });

    it('should be able to measure low precision context', async () => {
      const evaluator = new ContextPrecision({
        model,
        scale: 1,
        context: testCases[2].context || [],
      });
      const result = await evaluator.score({ input: testCases[2].input, output: testCases[2].output });
      expect(isCloserTo(result.score, testCases[2].expectedResult.score, 0)).toBe(true);
    });

    it('should be able to measure mixed precision context', async () => {
      const evaluator = new ContextPrecision({
        model,
        scale: 1,
        context: testCases[3].context || [],
      });
      const result = await evaluator.score({ input: testCases[3].input, output: testCases[3].output });
      expect(isCloserTo(result.score, testCases[3].expectedResult.score, 0)).toBe(true);
    });

    it('should be able to measure no relevant context', async () => {
      const evaluator = new ContextPrecision({
        model,
        scale: 1,
        context: testCases[4].context || [],
      });
      const result = await evaluator.score({ input: testCases[4].input, output: testCases[4].output });
      expect(result.score).toBeCloseTo(testCases[4].expectedResult.score, 1);
    });
  },
  15 * SECONDS,
);
