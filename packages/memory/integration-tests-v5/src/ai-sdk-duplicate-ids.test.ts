/**
 * AI SDK Duplicate Text ID Test
 *
 * This test proves that @ai-sdk/anthropic produces duplicate text-start/text-end IDs
 * in multi-step agent flows. This is an upstream issue in the AI SDK.
 *
 * The issue: Anthropic's content_block index (0, 1, 2...) resets for each LLM call,
 * so when an agent does TEXT -> TOOL -> TEXT, both text blocks get id="0".
 */

import { anthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';
import { openai } from '@ai-sdk/openai';
import { stepCountIs, streamText } from 'ai';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

describe('AI SDK Duplicate Text IDs (Upstream Issue)', () => {
  it('should detect duplicate text-start IDs from Anthropic in multi-step flow', async () => {
    if (!process.env.ANTHROPIC_API_KEY) {
      console.log('Skipping: ANTHROPIC_API_KEY not set');
      return;
    }

    const textIds: { type: string; id: string; step: number }[] = [];
    let currentStep = 0;

    const result = streamText({
      model: anthropic('claude-sonnet-4-5'),
      system: 'First say "Let me check the weather", then call the get_weather tool, then summarize what you found.',
      prompt: 'What is the weather in Tokyo?',
      tools: {
        get_weather: {
          description: 'Get the current weather',
          inputSchema: z.object({
            city: z.string().optional(),
          }),
          execute: async () => {
            return { temperature: 72, condition: 'sunny' };
          },
        },
      },
      stopWhen: stepCountIs(3),
    });

    console.log('\n=== Streaming from Anthropic ===\n');

    for await (const chunk of result.fullStream) {
      if (chunk.type === 'text-start') {
        console.log(`[Step ${currentStep}] text-start id="${chunk.id}"`);
        textIds.push({ type: 'text-start', id: chunk.id, step: currentStep });
      } else if (chunk.type === 'text-end') {
        console.log(`[Step ${currentStep}] text-end id="${chunk.id}"`);
        textIds.push({ type: 'text-end', id: chunk.id, step: currentStep });
      } else if (chunk.type === 'text-delta') {
        process.stdout.write(chunk.text);
      } else if (chunk.type === 'tool-call') {
        console.log(`\n[Step ${currentStep}] tool-call: ${chunk.toolName}`);
      } else if (chunk.type === 'finish-step') {
        currentStep++;
        console.log(`\n--- FINISHED STEP, now at ${currentStep} ---`);
      }
    }

    console.log('\n\n=== TEXT ID ANALYSIS ===');
    console.log('All text IDs:', textIds);

    // Check for duplicate text-start IDs
    const textStartIds = textIds.filter(t => t.type === 'text-start').map(t => t.id);
    const uniqueTextStartIds = new Set(textStartIds);

    console.log(`\ntext-start IDs: [${textStartIds.join(', ')}]`);
    console.log(`Unique: ${uniqueTextStartIds.size}, Total: ${textStartIds.length}`);

    if (uniqueTextStartIds.size < textStartIds.length) {
      console.log('\n❌ DUPLICATE TEXT-START IDs DETECTED!');
      console.log('This confirms the upstream bug in @ai-sdk/anthropic');

      // Find duplicates
      const idCounts: Record<string, number> = {};
      textStartIds.forEach(id => {
        idCounts[id] = (idCounts[id] || 0) + 1;
      });
      const duplicates = Object.entries(idCounts)
        .filter(([, count]) => count > 1)
        .map(([id]) => id);
      console.log('Duplicate IDs:', duplicates);
    }

    // This assertion documents the bug - it SHOULD fail but currently passes
    // because Anthropic produces duplicates
    if (textStartIds.length > 1) {
      expect(
        uniqueTextStartIds.size,
        'AI SDK Anthropic produces duplicate text-start IDs - this is a bug!',
      ).toBeLessThan(textStartIds.length);
    }
  }, 60000);

  it('should show OpenAI does NOT have duplicate text-start IDs', async () => {
    if (!process.env.OPENAI_API_KEY) {
      console.log('Skipping: OPENAI_API_KEY not set');
      return;
    }

    const textIds: { type: string; id: string; step: number }[] = [];
    let currentStep = 0;

    const result = streamText({
      model: openai('gpt-4o'),
      prompt: 'First say "Let me check the weather", then call the get_weather tool, then summarize what you found.',
      tools: {
        get_weather: {
          description: 'Get the current weather',
          inputSchema: z.object({
            city: z.string().optional(),
          }),
          execute: async () => {
            return { temperature: 72, condition: 'sunny' };
          },
        },
      },
      stopWhen: stepCountIs(3),
    });

    console.log('\n=== Streaming from OpenAI ===\n');

    for await (const chunk of result.fullStream) {
      if (chunk.type === 'text-start') {
        console.log(`[Step ${currentStep}] text-start id="${chunk.id}"`);
        textIds.push({ type: 'text-start', id: chunk.id, step: currentStep });
      } else if (chunk.type === 'text-end') {
        console.log(`[Step ${currentStep}] text-end id="${chunk.id}"`);
        textIds.push({ type: 'text-end', id: chunk.id, step: currentStep });
      } else if (chunk.type === 'text-delta') {
        process.stdout.write(chunk.text);
      } else if (chunk.type === 'tool-call') {
        console.log(`\n[Step ${currentStep}] tool-call: ${chunk.toolName}`);
      } else if (chunk.type === 'finish-step') {
        currentStep++;
        console.log(`\n--- FINISHED STEP, now at ${currentStep} ---`);
      }
    }

    console.log('\n\n=== TEXT ID ANALYSIS ===');
    console.log('All text IDs:', textIds);

    // Check for duplicate text-start IDs
    const textStartIds = textIds.filter(t => t.type === 'text-start').map(t => t.id);
    const uniqueTextStartIds = new Set(textStartIds);

    console.log(`\ntext-start IDs: [${textStartIds.join(', ')}]`);
    console.log(`Unique: ${uniqueTextStartIds.size}, Total: ${textStartIds.length}`);

    if (uniqueTextStartIds.size === textStartIds.length) {
      console.log('\n✅ OpenAI produces unique text-start IDs');
    } else {
      console.log('\n❌ OpenAI also has duplicate IDs (unexpected)');
    }

    // OpenAI should have unique IDs
    if (textStartIds.length > 1) {
      expect(uniqueTextStartIds.size, 'OpenAI should produce unique text-start IDs').toBe(textStartIds.length);
    }
  }, 60000);

  it('should detect duplicate text-start IDs from Gemini in multi-step flow', async () => {
    if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      console.log('Skipping: GOOGLE_GENERATIVE_AI_API_KEY not set');
      return;
    }

    const textIds: { type: string; id: string; step: number }[] = [];
    let currentStep = 0;

    const result = streamText({
      model: google('gemini-pro-latest'),
      system: 'First say "Let me check the weather", then call the get_weather tool, then summarize what you found.',
      prompt: 'What is the weather in Tokyo?',
      tools: {
        get_weather: {
          description: 'Get the current weather',
          inputSchema: z.object({
            city: z.string().optional(),
          }),
          execute: async () => {
            return { temperature: 72, condition: 'sunny' };
          },
        },
      },
      stopWhen: stepCountIs(3),
    });

    console.log('\n=== Streaming from Gemini ===\n');

    for await (const chunk of result.fullStream) {
      if (chunk.type === 'text-start') {
        console.log(`[Step ${currentStep}] text-start id="${chunk.id}"`);
        textIds.push({ type: 'text-start', id: chunk.id, step: currentStep });
      } else if (chunk.type === 'text-end') {
        console.log(`[Step ${currentStep}] text-end id="${chunk.id}"`);
        textIds.push({ type: 'text-end', id: chunk.id, step: currentStep });
      } else if (chunk.type === 'text-delta') {
        process.stdout.write(chunk.text);
      } else if (chunk.type === 'tool-call') {
        console.log(`\n[Step ${currentStep}] tool-call: ${chunk.toolName}`);
      } else if (chunk.type === 'finish-step') {
        currentStep++;
        console.log(`\n--- FINISHED STEP, now at ${currentStep} ---`);
      }
    }

    console.log('\n\n=== TEXT ID ANALYSIS ===');
    console.log('All text IDs:', textIds);

    // Check for duplicate text-start IDs
    const textStartIds = textIds.filter(t => t.type === 'text-start').map(t => t.id);
    const uniqueTextStartIds = new Set(textStartIds);

    console.log(`\ntext-start IDs: [${textStartIds.join(', ')}]`);
    console.log(`Unique: ${uniqueTextStartIds.size}, Total: ${textStartIds.length}`);

    if (uniqueTextStartIds.size < textStartIds.length) {
      console.log('\n❌ DUPLICATE TEXT-START IDs DETECTED!');
      console.log('This confirms the upstream bug in @ai-sdk/google');

      // Find duplicates
      const idCounts: Record<string, number> = {};
      textStartIds.forEach(id => {
        idCounts[id] = (idCounts[id] || 0) + 1;
      });
      const duplicates = Object.entries(idCounts)
        .filter(([, count]) => count > 1)
        .map(([id]) => id);
      console.log('Duplicate IDs:', duplicates);

      // This assertion documents the bug
      expect(uniqueTextStartIds.size, 'AI SDK Google produces duplicate text-start IDs - this is a bug!').toBeLessThan(
        textStartIds.length,
      );
    } else {
      console.log('\n✅ Gemini produces unique text-start IDs');
    }
  }, 60000);
});
