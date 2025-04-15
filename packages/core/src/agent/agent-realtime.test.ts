import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Agent, ToolsInput } from './index';
import { MastraRealtime } from '../realtime';
import { openai } from '@ai-sdk/openai';

describe('realtime capabilities', () => {
  class MockRealtime extends MastraRealtime {
    async connect() {
      return Promise.resolve();
    }

    addTools(_tools: ToolsInput): void {}

    addInstructions(_instructions: string): void {
      return;
    }
  }

  it('should have a realtime provider', async () => {
    const realtimeAgent = new Agent({
      name: 'Realtime Agent',
      instructions: 'You are an agent with realtime capabilities',
      model: openai('gpt-4o'),
    });

    expect(realtimeAgent.realtime).toBeDefined();
  });

  it('Should connect to realtime provider', async () => {
    const realtimeAgent = new Agent({
      name: 'Realtime Agent',
      instructions: 'You are an agent with realtime capabilities',
      model: openai('gpt-4o'),
      realtime: new MockRealtime(),
    });

    await realtimeAgent.realtime.connect();
  });
});
