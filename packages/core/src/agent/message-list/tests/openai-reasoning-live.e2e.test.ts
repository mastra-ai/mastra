/**
 * Live test against the real OpenAI API to verify reasoning round-trip works
 * with v3 providers after removing the reasoning-stripping workaround.
 *
 * NOT meant for CI — requires OPENAI_API_KEY and makes real API calls.
 * Run manually:
 *   cd packages/core && npx vitest run src/agent/message-list/tests/openai-reasoning-live.e2e.test.ts
 *
 * After validating, extract fixtures into deterministic CI tests.
 */
import { createOpenAI } from '@ai-sdk/openai-v6';
import type { LanguageModelV3 } from '@ai-sdk/provider-v6';
import { describe, expect, it } from 'vitest';
import { MessageList } from '../index';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

describe.skipIf(!OPENAI_API_KEY)('OpenAI reasoning live round-trip', () => {
  it('should complete a multi-turn conversation with reasoning model', async () => {
    const openai = createOpenAI({ apiKey: OPENAI_API_KEY });
    const model: LanguageModelV3 = openai('gpt-5-mini') as any;

    // Turn 1: Simple question to get reasoning + text response
    const turn1 = await model.doGenerate({
      prompt: [{ role: 'user', content: [{ type: 'text', text: 'What is 2+2? Answer in one word.' }] }],
      providerOptions: {
        openai: { reasoningEffort: 'low' },
      },
    });

    console.log('\n=== Turn 1 Result ===');
    console.log('Content:', JSON.stringify(turn1.content, null, 2));

    // Extract reasoning and text from content
    const reasoningContent = turn1.content.filter(c => c.type === 'reasoning');
    const textContent = turn1.content.filter(c => c.type === 'text');

    console.log('\n=== Turn 1 Reasoning ===');
    console.log(JSON.stringify(reasoningContent, null, 2));
    console.log('\n=== Turn 1 Text ===');
    console.log(JSON.stringify(textContent, null, 2));

    expect(textContent.length).toBeGreaterThan(0);

    // Now simulate Mastra's flow: build MessageList from response, reload, prompt again
    const list = new MessageList();
    list.add({ role: 'user', content: 'What is 2+2? Answer in one word.' }, 'input');

    // Build assistant message parts from the v3 response content
    // This simulates what Mastra stores after a streaming response
    const assistantParts: any[] = [];

    for (const item of turn1.content) {
      if (item.type === 'reasoning') {
        assistantParts.push({
          type: 'reasoning',
          reasoning: '',
          details: [{ type: 'text', text: item.text || '' }],
          providerMetadata: {
            openai: {
              itemId: (item as any).providerMetadata?.openai?.itemId,
              reasoningEncryptedContent: (item as any).providerMetadata?.openai?.reasoningEncryptedContent,
            },
          },
        });
      } else if (item.type === 'text') {
        assistantParts.push({
          type: 'text',
          text: item.text,
          providerMetadata: {
            openai: {
              itemId: (item as any).providerMetadata?.openai?.itemId,
            },
          },
        });
      }
    }

    console.log('\n=== DB Parts ===');
    console.log(JSON.stringify(assistantParts, null, 2));

    list.add(
      {
        id: 'assistant-turn1',
        role: 'assistant',
        content: { format: 2, parts: assistantParts },
        createdAt: new Date(),
        threadId: 'thread-live-test',
      },
      'response',
    );

    // Turn 2: Follow up
    list.add({ role: 'user', content: 'Now what is 3+3? Answer in one word.' }, 'input');

    // Get the prompt that would be sent to the LLM
    const prompt = list.get.all.aiV5.prompt();

    console.log('\n=== Prompt for Turn 2 ===');
    for (const msg of prompt) {
      if (Array.isArray(msg.content)) {
        const parts = msg.content.map((p: any) => {
          const itemId = p.providerOptions?.openai?.itemId;
          return `${p.type}${itemId ? `(${itemId})` : ''}`;
        });
        console.log(`  ${msg.role}: [${parts.join(', ')}]`);
      } else {
        const text = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
        console.log(`  ${msg.role}: ${text.slice(0, 80)}`);
      }
    }

    // Verify reasoning is preserved in the prompt
    const assistantMsgs = prompt.filter(m => m.role === 'assistant');
    const allParts = assistantMsgs.flatMap(m => (Array.isArray(m.content) ? m.content : []));
    const promptReasoningParts = allParts.filter((p: any) => p.type === 'reasoning');
    console.log(`\nReasoning parts in prompt: ${promptReasoningParts.length}`);
    expect(promptReasoningParts.length).toBeGreaterThan(0);

    // Now send Turn 2 to the real API using the v3 model directly
    // This is where "item missing its reasoning part" would blow up
    console.log('\n=== Sending Turn 2 to API via v3 provider ===');
    const turn2 = await model.doGenerate({
      prompt: prompt as any, // v5 ModelMessage[] is runtime-compatible with v3 prompt
      providerOptions: {
        openai: { reasoningEffort: 'low' },
      },
    });

    const turn2Text = turn2.content.filter(c => c.type === 'text');
    console.log('Turn 2 text:', turn2Text.map(t => t.text).join(''));

    expect(turn2Text.length).toBeGreaterThan(0);
    expect(turn2Text[0].text.length).toBeGreaterThan(0);

    console.log('\n=== SUCCESS: Multi-turn reasoning round-trip completed ===');
  }, 30_000);
});
