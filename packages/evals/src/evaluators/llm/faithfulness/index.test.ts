import { createOpenAI } from '@ai-sdk/openai';
import { describe, it, expect } from 'vitest';

import type { TestCase } from '../types';
import { isCloserTo } from '../utils';

import { Faithfulness } from './index';

const testCases: TestCase[] = [
  {
    // Perfect faithfulness - all claims are supported by context
    input: 'Tell me about the solar system',
    output:
      'The solar system consists of the Sun and eight planets. Mercury is the closest planet to the Sun, while Neptune is the farthest. Earth is the only known planet with liquid water on its surface.',
    context: [
      'The solar system is composed of the Sun and the objects that orbit it, including eight planets: Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus, and Neptune.',
      'Mercury is the closest planet to the Sun, with an average distance of about 36 million miles.',
      'Neptune is the farthest planet from the Sun in our solar system, at an average distance of 2.8 billion miles.',
      'Earth is the only known celestial body in the solar system with stable bodies of liquid water on its surface.',
    ],
    expectedResult: {
      score: 1.0,
      reason:
        'The score is 1.0 because all claims in the output are directly supported by the context. The statements about the solar system composition, Mercury being closest to the Sun, Neptune being farthest, and Earth having liquid water are all explicitly mentioned in the context.',
    },
  },
  {
    // Mixed faithfulness - some claims supported, some contradicted
    input: 'Describe the structure of an atom',
    output:
      "An atom consists of a nucleus containing protons and neutrons, with electrons orbiting around it. Protons have a positive charge, electrons have a negative charge, and neutrons have no charge. The number of protons in an atom is always equal to the number of electrons, making atoms electrically neutral. The nucleus makes up most of the atom's mass.",
    context: [
      'An atom is composed of a central nucleus containing protons and neutrons, surrounded by electrons that orbit the nucleus.',
      'Protons carry a positive electric charge, electrons carry a negative electric charge, and neutrons are electrically neutral.',
      'In a neutral atom, the number of protons equals the number of electrons, resulting in no net electric charge.',
      "Although the nucleus is very dense and contains most of the atom's mass, it occupies less than one trillionth of the atom's volume.",
    ],
    expectedResult: {
      score: 0.8,
      reason:
        "The score is 0.8 because 4 out of 5 claims in the output are directly supported by the context. The statements about the atom's structure, particle charges, and electrical neutrality are all accurate. However, the claim that \"the nucleus makes up most of the atom's mass\" is contradicted by the context, which states that the nucleus occupies a tiny fraction of the atom's volume.",
    },
  },
  {
    // Low faithfulness - most claims are unsupported or contradicted
    input: 'What is photosynthesis?',
    output:
      'Photosynthesis is the process by which animals convert sunlight into glucose. It requires carbon dioxide, water, and nitrogen. The process produces oxygen and sugar as byproducts. Photosynthesis occurs in the mitochondria of plant cells.',
    context: [
      'Photosynthesis is the process by which plants, algae, and certain bacteria convert light energy, usually from the Sun, into chemical energy in the form of glucose.',
      'The process requires carbon dioxide and water as inputs and releases oxygen as a byproduct.',
      'In plants, photosynthesis takes place primarily in the chloroplasts, specifically in the chlorophyll-containing structures called thylakoids.',
    ],
    expectedResult: {
      score: 0.2,
      reason:
        'The score is 0.2 because only 1 out of 5 claims in the output is supported by the context. The statement about producing oxygen is correct. However, the claims that animals (not plants) perform photosynthesis, that nitrogen is required, and that photosynthesis occurs in mitochondria (not chloroplasts) are all contradicted by the context.',
    },
  },
  {
    // Zero faithfulness - all claims are unsupported or contradicted
    input: 'Explain how vaccines work',
    output:
      'Vaccines work by introducing a live virus into the bloodstream. The virus multiplies rapidly, causing a mild form of the disease. This makes the body permanently immune to all strains of the virus. Vaccines always provide 100% protection against diseases.',
    context: [
      'Vaccines work by introducing a weakened, dead, or partial version of a pathogen that cannot cause disease but still triggers an immune response.',
      'The immune system recognizes the vaccine components as foreign, produces antibodies against them, and develops memory cells.',
      'If the vaccinated person later encounters the actual pathogen, their immune system can quickly recognize and neutralize it before illness develops.',
      'Vaccine effectiveness varies by type, with some providing near-complete protection and others offering partial protection against severe disease.',
    ],
    expectedResult: {
      score: 0.0,
      reason:
        'The score is 0.0 because none of the claims in the output are supported by the context. The statements about introducing live viruses, causing mild disease, permanent immunity to all strains, and 100% protection are all contradicted by the context, which describes vaccines as using weakened/dead pathogens, not causing disease, and having varying effectiveness.',
    },
  },
  {
    // Partial faithfulness with speculative claims
    input: 'What are the effects of climate change?',
    output:
      'Climate change is causing global temperatures to rise. Sea levels are increasing due to melting ice caps. Extreme weather events may become more frequent. Some regions might experience severe droughts, while others could see increased rainfall.',
    context: [
      'Global average temperatures have increased by approximately 1.1°C since the pre-industrial era due to human-induced climate change.',
      'Rising sea levels are a direct consequence of climate change, primarily due to thermal expansion of seawater and melting ice sheets and glaciers.',
      'Climate models project an increase in the frequency and intensity of extreme weather events, including heatwaves, heavy precipitation, and droughts in many regions.',
    ],
    expectedResult: {
      score: 0.6,
      reason:
        'The score is 0.6 because 3 out of 5 claims in the output are supported by the context. The statements about rising temperatures, sea levels increasing, and extreme weather events becoming more frequent are all supported. However, the speculative claims about specific regions experiencing droughts or increased rainfall are not directly addressed in the context.',
    },
  },
];

const SECONDS = 10000;

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const model = openai('gpt-4o');

describe(
  'FaithfulnessEvaluator',
  () => {
    it('should detect perfect faithfulness when all claims are supported by context', async () => {
      const testCase = testCases[0]!;
      const evaluator = new Faithfulness({ model, context: testCase.context });
      const result = await evaluator.score({ input: testCase.input, output: testCase.output });
      expect(result.score).toBeCloseTo(testCase.expectedResult.score, 1);
    });

    it('should handle mixed faithfulness with some supported and some contradicted claims', async () => {
      const testCase = testCases[1]!;
      const evaluator = new Faithfulness({ model, context: testCase.context });
      const result = await evaluator.score({ input: testCase.input, output: testCase.output });
      expect(isCloserTo(result.score, testCase.expectedResult.score, 0)).toBe(true);
    });

    it('should identify low faithfulness when most claims are unsupported or contradicted', async () => {
      const testCase = testCases[2]!;
      const evaluator = new Faithfulness({ model, context: testCase.context });
      const result = await evaluator.score({ input: testCase.input, output: testCase.output });
      expect(isCloserTo(result.score, testCase.expectedResult.score, 0)).toBe(true);
    });

    it('should detect zero faithfulness when all claims are unsupported or contradicted', async () => {
      const testCase = testCases[3]!;
      const evaluator = new Faithfulness({ model, context: testCase.context });
      const result = await evaluator.score({ input: testCase.input, output: testCase.output });
      expect(result.score).toBeCloseTo(testCase.expectedResult.score, 1);
    });

    it('should evaluate partial faithfulness with speculative claims', async () => {
      const testCase = testCases[4]!;
      const evaluator = new Faithfulness({ model, context: testCase.context });
      const result = await evaluator.score({ input: testCase.input, output: testCase.output });
      expect(isCloserTo(result.score, testCase.expectedResult.score, 0.2)).toBe(true);
    });

    it('should handle perfect faithfulness', async () => {
      const testCase = testCases[0]!;
      const metric = new Faithfulness({ model, context: testCase.context });
      const result = await metric.score({ input: testCase.input, output: testCase.output });

      expect(result.score).toBeCloseTo(testCase.expectedResult.score, 1);
    });

    it('should handle mixed faithfulness with contradictions', async () => {
      const testCase = testCases[1]!;
      const metric = new Faithfulness({ model, context: testCase.context });
      const result = await metric.score({ input: testCase.input, output: testCase.output });

      expect(result.score).toBeCloseTo(testCase.expectedResult.score, 1);
    });

    it('should handle claims with speculative language', async () => {
      const testCase = testCases[2]!;
      const metric = new Faithfulness({ model, context: testCase.context });
      const result = await metric.score({ input: testCase.input, output: testCase.output });

      expect(result.score).toBeCloseTo(testCase.expectedResult.score, 1);
    });

    it('should handle empty output', async () => {
      const testCase = testCases[3]!;
      const metric = new Faithfulness({ model, context: testCase.context });
      const result = await metric.score({ input: testCase.input, output: testCase.output });

      expect(result.score).toBe(testCase.expectedResult.score);
    });

    it('should handle empty context', async () => {
      const testCase = testCases[4]!;
      const metric = new Faithfulness({ model, context: testCase.context });
      const result = await metric.score({ input: testCase.input, output: testCase.output });

      expect(result.score).toBe(testCase.expectedResult.score);
    });

    it('should handle subjective claims', async () => {
      const testCase = testCases[5]!;
      const metric = new Faithfulness({ model, context: testCase.context });
      const result = await metric.score({ input: testCase.input, output: testCase.output });

      expect(result.score).toBe(testCase.expectedResult.score);
    });

    it('should handle claims with speculative language appropriately', async () => {
      const testCase = testCases[6]!;
      const metric = new Faithfulness({ model, context: testCase.context });
      const result = await metric.score({ input: testCase.input, output: testCase.output });

      expect(result.score).toBeCloseTo(testCase.expectedResult.score, 1);
    });

    it('should handle compound statements correctly', async () => {
      const testCase = testCases[7]!;
      const metric = new Faithfulness({ model, context: testCase.context });
      const result = await metric.score({ input: testCase.input, output: testCase.output });

      expect(result.score).toBeCloseTo(testCase.expectedResult.score, 1);
    });

    it('should handle precise numerical claims', async () => {
      const testCase = testCases[8]!;
      const metric = new Faithfulness({ model, context: testCase.context });
      const result = await metric.score({ input: testCase.input, output: testCase.output });

      expect(result.score).toBe(testCase.expectedResult.score);
    });

    it('should handle partially supported claims', async () => {
      const testCase = testCases[9]!;
      const metric = new Faithfulness({ model, context: testCase.context });
      const result = await metric.score({ input: testCase.input, output: testCase.output });

      expect(result.score).toBeCloseTo(testCase.expectedResult.score, 1);
    });

    it('should handle mixed factual and speculative claims', async () => {
      const testCase = testCases[10]!;
      const metric = new Faithfulness({ model, context: testCase.context });
      const result = await metric.score({ input: testCase.input, output: testCase.output });

      expect(result.score).toBeCloseTo(testCase.expectedResult.score, 1);
    });

    it('should handle implicit information appropriately', async () => {
      const testCase = testCases[11]!;
      const metric = new Faithfulness({ model, context: testCase.context });
      const result = await metric.score({ input: testCase.input, output: testCase.output });

      expect(result.score).toBeCloseTo(testCase.expectedResult.score, 1);
    });
  },
  15 * SECONDS,
);
