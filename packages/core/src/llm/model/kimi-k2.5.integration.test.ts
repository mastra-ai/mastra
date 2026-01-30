import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { Agent } from '../../agent/index.js';

/**
 * Kimi K2.5 (moonshotai) integration test for multi-step tool calling.
 *
 * This reproduces a bug where the model returns reasoning_content alongside
 * tool calls, but the AI SDK didn't send reasoning_content back in follow-up
 * assistant messages — causing the Moonshot API to reject the request with:
 *   "thinking is enabled but reasoning_content is missing in assistant tool call message"
 *
 * Fixed by upgrading @ai-sdk/openai-compatible to 1.0.32+.
 *
 * This test is mostly for debugging future regressions and is not critical
 * to run in CI (requires MOONSHOT_API_KEY).
 */

const tokenTool = {
  description: 'Generate a token that must be used in the next tool call',
  parameters: z.object({}),
  execute: async () => {
    return {
      token: `token-${Date.now()}`,
    };
  },
};

const confirmTokenTool = {
  description: 'Confirm that a token was received from get_token',
  parameters: z.object({
    token: z.string().describe('The token returned by get_token'),
  }),
  execute: async ({ token }: { token: string }) => {
    return {
      confirmedToken: token,
    };
  },
};

describe.skipIf(!process.env.MOONSHOT_API_KEY)('Kimi K2.5 Integration Tests', () => {
  it('completes multi-step tool calls without reasoning_content errors', async () => {

    const agent = new Agent({
      id: 'moonshotai-kimi-k2-5-test',
      name: 'moonshotai-kimi-k2-5-test',
      instructions:
        'Always call get_token first, wait for its result, then call confirm_token with the returned token.',
      model: 'moonshotai/kimi-k2.5',
      tools: {
        get_token: tokenTool,
        confirm_token: confirmTokenTool,
      },
    });

    const result = await agent.generate(
      'Call get_token, then confirm_token with the token value. After both tool calls succeed, reply with "done".',
      {
        maxSteps: 3,
        toolChoice: 'auto',
        modelSettings: {
          temperature: 1,
        },
      },
    );

    expect(result.text).toMatch(/done/i);
  });
});
