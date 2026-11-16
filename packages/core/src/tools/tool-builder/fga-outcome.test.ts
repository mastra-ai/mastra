import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { FGADeniedError } from '../../auth/ee/fga-check';
import type { IFGAProvider } from '../../auth/ee/interfaces/fga';
import { captureOutcomeEvents } from '../../loop/test-utils/aimock/outcome-test-utils';
import { Mastra } from '../../mastra';
import { SpanType } from '../../observability';
import { RequestContext } from '../../request-context';
import { createTool } from '../tool';
import { CoreToolBuilder } from './builder';

describe('tool authorization outcomes', () => {
  it('closes a denied tool span and returns the original authorization error', async () => {
    const { observability, ended } = captureOutcomeEvents();
    const user = { id: 'customer' };
    const denial = new FGADeniedError(user, { type: 'tool', id: 'refund' }, 'tools:execute');
    const before = Object.getOwnPropertyDescriptors(denial);
    const mastra = new Mastra({
      observability,
      server: {
        fga: {
          require: async () => {
            throw denial;
          },
        } as IFGAProvider,
      },
    });
    const requestContext = new RequestContext();
    requestContext.set('user', user);
    let executed = false;
    const tool = new CoreToolBuilder({
      originalTool: createTool({
        id: 'refund',
        description: 'Refund an order',
        inputSchema: z.object({}),
        execute: async () => {
          executed = true;
          return {};
        },
      }),
      options: {
        name: 'refund',
        mastra,
        requestContext,
        model: { provider: 'openai', modelId: 'gpt-4.1', specificationVersion: 'v2', supportsStructuredOutputs: false },
      },
    }).build();
    await expect(tool.execute?.({}, { toolCallId: 'refund-call', messages: [] })).rejects.toBe(denial);
    expect(executed).toBe(false);
    expect(Object.getOwnPropertyDescriptors(denial)).toEqual(before);
    expect(ended(SpanType.TOOL_CALL)).toMatchObject([{ outcome: 'blocked', stopReason: 'authorization' }]);
  });
});
