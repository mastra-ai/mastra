import { createWorkflow, createStep } from '@mastra/core/workflows';
import { z } from 'zod';

// Step 1: Analyze the input text
const analyzeStep = createStep({
  id: 'analyze-text',
  description: 'Analyzes the input text and extracts metadata',
  inputSchema: z.object({
    text: z.string(),
  }),
  outputSchema: z.object({
    text: z.string(),
    charCount: z.number(),
    wordCount: z.number(),
  }),
  execute: async ({ inputData }) => {
    const { text } = inputData;
    const trimmed = text.trim();
    const wordCount = trimmed === '' ? 0 : trimmed.split(/\s+/).length;
    return {
      text,
      charCount: text.length,
      wordCount,
    };
  },
});

// Step 2: Reverse the text
const reverseStep = createStep({
  id: 'reverse-text',
  description: 'Reverses the text character by character',
  inputSchema: z.object({
    text: z.string(),
    charCount: z.number(),
    wordCount: z.number(),
  }),
  outputSchema: z.object({
    original: z.string(),
    reversed: z.string(),
    charCount: z.number(),
    wordCount: z.number(),
  }),
  execute: async ({ inputData }) => {
    const { text, charCount, wordCount } = inputData;
    return {
      original: text,
      reversed: text.split('').reverse().join(''),
      charCount,
      wordCount,
    };
  },
});

// Step 3: Transform to uppercase
const uppercaseStep = createStep({
  id: 'uppercase-text',
  description: 'Converts the reversed text to uppercase',
  inputSchema: z.object({
    original: z.string(),
    reversed: z.string(),
    charCount: z.number(),
    wordCount: z.number(),
  }),
  outputSchema: z.object({
    original: z.string(),
    reversed: z.string(),
    uppercased: z.string(),
    charCount: z.number(),
    wordCount: z.number(),
  }),
  execute: async ({ inputData }) => {
    const { original, reversed, charCount, wordCount } = inputData;
    return {
      original,
      reversed,
      uppercased: reversed.toUpperCase(),
      charCount,
      wordCount,
    };
  },
});

// Step 4: Format the final output with decorative borders
const formatStep = createStep({
  id: 'format-output',
  description: 'Adds decorative formatting to the final result',
  inputSchema: z.object({
    original: z.string(),
    reversed: z.string(),
    uppercased: z.string(),
    charCount: z.number(),
    wordCount: z.number(),
  }),
  outputSchema: z.object({
    result: z.string(),
  }),
  execute: async ({ inputData }) => {
    const { original, uppercased, charCount, wordCount } = inputData;
    const borderLen = Math.max(uppercased.length + 4, 30);
    const border = '═'.repeat(borderLen);

    const pad = (str: string) => str.padEnd(borderLen + 1) + '║';

    const result = [
      `╔${border}╗`,
      pad(`║ 🔄 REVERSE TRANSFORMATION COMPLETE`),
      `╠${border}╣`,
      pad(`║ Original: "${original}"`),
      pad(`║ Result:   "${uppercased}"`),
      pad(`║ Stats:    ${charCount} chars, ${wordCount} words`),
      `╚${border}╝`,
    ].join('\n');

    return { result };
  },
});

// Create the 4-step workflow
export const reverseWorkflow = createWorkflow({
  id: 'reverse-workflow',
  description: 'A 4-step workflow that analyzes, reverses, uppercases, and formats text',
  inputSchema: z.object({
    text: z.string(),
  }),
  outputSchema: z.object({
    result: z.string(),
  }),
})
  .then(analyzeStep)
  .then(reverseStep)
  .then(uppercaseStep)
  .then(formatStep)
  .commit();
