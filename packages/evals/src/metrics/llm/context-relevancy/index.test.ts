import { createOpenAI } from '@ai-sdk/openai';
import { describe, it, expect } from 'vitest';

import type { TestCaseWithContext } from '../utils';
import { isCloserTo } from '../utils';

import { ContextRelevancyMetric } from './index';

const testCases: TestCaseWithContext[] = [
  {
    // Perfect relevancy - all context pieces directly address the question
    input: 'What are the symptoms and treatment options for type 2 diabetes?',
    output:
      'Type 2 diabetes symptoms include increased thirst, frequent urination, fatigue, and blurred vision. Treatment options include lifestyle changes, blood sugar monitoring, and medications like metformin or insulin therapy.',
    context: [
      'Common symptoms of type 2 diabetes include increased thirst, frequent urination, unexplained weight loss, fatigue, and blurred vision. Early detection of these symptoms is crucial for proper management.',
      'Treatment options for type 2 diabetes typically include lifestyle modifications such as diet changes and regular exercise. Regular monitoring of blood sugar levels is essential for managing the condition.',
      'Medications for type 2 diabetes may include metformin, sulfonylureas, or insulin therapy, depending on the severity of the condition and individual patient factors.',
    ],
    expectedResult: {
      score: 1.0,
      reason:
        'All context pieces are highly relevant to the question, providing specific information about both symptoms and treatments for type 2 diabetes. Each piece of context directly contributes to answering the question comprehensively.',
    },
  },
  {
    // Mixed relevancy - some context pieces are relevant, others tangential
    input: 'What caused the 2008 financial crisis?',
    output:
      'The 2008 financial crisis was caused by the collapse of the subprime mortgage market, though there were other contributing factors in the banking sector.',
    context: [
      'The 2008 financial crisis was primarily triggered by the collapse of the subprime mortgage market in the United States.',
      'The history of banking regulation in the United States dates back to the Great Depression of the 1930s.',
      'Modern investment banking practices involve various financial instruments and risk management strategies.',
    ],
    expectedResult: {
      score: 0.5,
      reason:
        "Only one context piece directly addresses the cause of the 2008 financial crisis. The other two pieces provide general banking information that isn't specifically relevant to the question about the crisis's causes.",
    },
  },
  {
    // Zero relevancy - completely unrelated context
    input: 'How does a solar eclipse occur?',
    output:
      "A solar eclipse occurs when the Moon passes between the Earth and the Sun, temporarily blocking part or all of the Sun's light.",
    context: [
      'Volcanic eruptions can have significant impacts on local weather patterns and air quality.',
      'The Amazon rainforest is home to countless species of plants and animals.',
      'Wind turbines convert kinetic energy from wind into electrical power.',
    ],
    expectedResult: {
      score: 0.0,
      reason:
        'None of the provided context pieces contain any information about solar eclipses or related astronomical phenomena. The contexts discuss entirely unrelated topics such as volcanoes, rainforests, and wind power.',
    },
  },
  {
    // Only recent developments are relevant when asking for 'latest'
    input: 'What are the latest developments in quantum computing?',
    output: 'Recent advances include improved error correction and the development of more stable qubits.',
    context: [
      'In 2023, researchers achieved a breakthrough in quantum error correction, significantly improving qubit stability.',
      'The basic principles of quantum computing were first proposed in the 1980s.',
      'Classical computers use bits that are either 0 or 1.',
    ],
    expectedResult: {
      score: 0.33,
      reason:
        'Only the first context piece about 2023 breakthroughs is relevant to "latest developments". Historical information about 1980s principles and basic classical computing concepts are not relevant when specifically asking about recent developments.',
    },
  },
  {
    // Full relevancy with complementary details
    input: 'How do electric cars work?',
    output:
      'Electric cars use batteries to power an electric motor, converting electrical energy to mechanical energy for propulsion.',
    context: [
      'Electric vehicles (EVs) use large battery packs to store electrical energy, which powers one or more electric motors.',
      'The motors in EVs convert electrical energy into mechanical energy through electromagnetic principles.',
      'Modern EVs typically use lithium-ion batteries, though some early models used lead-acid or nickel-metal hydride batteries.',
    ],
    expectedResult: {
      score: 1.0,
      reason:
        'All three context pieces are fully relevant to explaining how electric cars work: the first describes the core power flow from batteries to motors, the second explains the energy conversion process, and the third details the types of batteries used for power storage. Each piece contributes a different but essential aspect of EV operation.',
    },
  },
  {
    // Zero relevancy with misleading keyword matches
    input: 'What is the capital of France?',
    output: 'Paris is the capital of France.',
    context: [
      'Paris Hilton is a well-known American media personality.',
      'The Paris Agreement is a global climate change treaty.',
      'Paris, Texas is a city in Lamar County.',
    ],
    expectedResult: {
      score: 0.0,
      reason:
        'All context pieces contain the word "Paris" but are completely irrelevant to the capital of France. Each discusses a different entity (a person, a treaty, and a US city) that just happens to share the name. Matching keywords alone do not constitute relevance when the underlying topics are unrelated.',
    },
  },
];

const SECONDS = 10000;

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const model = openai('gpt-4o');

describe(
  'ContextRelevancyMetric',
  () => {
    it('should detect perfect relevancy when all context pieces directly address the question', async () => {
      const testCase = testCases[0]!;
      const metric = new ContextRelevancyMetric(model, { context: testCase.context });
      const result = await metric.measure(testCase.input, testCase.output);
      expect(result.score).toBeCloseTo(testCase.expectedResult.score, 1);
    });

    it('should handle mixed relevancy with some relevant and some tangential context', async () => {
      const testCase = testCases[1]!;
      const metric = new ContextRelevancyMetric(model, { context: testCase.context });
      const result = await metric.measure(testCase.input, testCase.output);
      expect(isCloserTo(result.score, testCase.expectedResult.score, 0)).toBe(true);
    });

    it('should identify zero relevancy with completely unrelated context', async () => {
      const testCase = testCases[2]!;
      const metric = new ContextRelevancyMetric(model, { context: testCase.context });
      const result = await metric.measure(testCase.input, testCase.output);
      expect(result.score).toBeCloseTo(testCase.expectedResult.score, 1);
    });

    it('should evaluate temporal relevancy with mix of current and historical context', async () => {
      const testCase = testCases[3]!;
      const metric = new ContextRelevancyMetric(model, { context: testCase.context });
      const result = await metric.measure(testCase.input, testCase.output);
      expect(result.score).toBeCloseTo(testCase.expectedResult.score, 1);
    });

    it('should handle high relevancy with varying levels of detail', async () => {
      const testCase = testCases[4]!;
      const metric = new ContextRelevancyMetric(model, { context: testCase.context });
      const result = await metric.measure(testCase.input, testCase.output);
      expect(result.score).toBeCloseTo(testCase.expectedResult.score, 1);
    });

    it('should detect low relevancy with misleading keyword matches', async () => {
      const testCase = testCases[5]!;
      const metric = new ContextRelevancyMetric(model, { context: testCase.context });
      const result = await metric.measure(testCase.input, testCase.output);
      expect(result.score).toBeCloseTo(testCase.expectedResult.score, 1);
    });
  },
  {
    timeout: 15 * SECONDS,
  },
);
