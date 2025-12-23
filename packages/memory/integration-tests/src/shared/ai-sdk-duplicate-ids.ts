/**
 * AI SDK Duplicate Text ID Test
 *
 * This test proves that some AI SDK providers produce duplicate text-start/text-end IDs
 * in multi-step agent flows. This is an upstream issue in the AI SDK.
 *
 * The issue: Some providers' content_block index (0, 1, 2...) resets for each LLM call,
 * so when an agent does TEXT -> TOOL -> TEXT, both text blocks get id="0".
 */

import { MastraModelConfig } from '@mastra/core/llm';
import { stepCountIs } from 'ai-v5';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

interface ModelConfig {
  name: string;
  streamTextFunction: any;
  model: MastraModelConfig;
  envVar: string;
  expectsDuplicates: boolean; // true if we expect this provider to have the bug
}

export function getAiSdkDuplicateIdsTests(models: ModelConfig[]) {
  describe('AI SDK Duplicate Text IDs (Upstream Issue)', () => {
    for (const { name, model, envVar, streamTextFunction, expectsDuplicates } of models) {
      it(`should ${expectsDuplicates ? 'detect duplicate' : 'verify unique'} text-start IDs from ${name} in multi-step flow`, async () => {
        if (!process.env[envVar]) {
          console.log(`Skipping: ${envVar} not set`);
          return;
        }

        const textIds: { type: string; id: string; step: number }[] = [];
        let currentStep = 0;

        const result = streamTextFunction({
          model,
          system:
            'First say "Let me check the weather", then call the get_weather tool, then summarize what you found.',
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

        console.log(`\n=== Streaming from ${name} ===\n`);

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
          console.log(`This confirms the upstream bug in @ai-sdk/${name.toLowerCase()}`);

          // Find duplicates
          const idCounts: Record<string, number> = {};
          textStartIds.forEach(id => {
            idCounts[id] = (idCounts[id] || 0) + 1;
          });
          const duplicates = Object.entries(idCounts)
            .filter(([, count]) => count > 1)
            .map(([id]) => id);
          console.log('Duplicate IDs:', duplicates);
        } else {
          console.log(`\n✅ ${name} produces unique text-start IDs`);
        }

        // Assert based on expected behavior
        if (textStartIds.length > 1) {
          if (expectsDuplicates) {
            // This assertion documents the bug - we expect duplicates
            expect(
              uniqueTextStartIds.size,
              `AI SDK ${name} produces duplicate text-start IDs - this is a known bug!`,
            ).toBeLessThan(textStartIds.length);
          } else {
            // This provider should have unique IDs
            expect(uniqueTextStartIds.size, `${name} should produce unique text-start IDs`).toBe(textStartIds.length);
          }
        }
      }, 60000);
    }
  });
}
