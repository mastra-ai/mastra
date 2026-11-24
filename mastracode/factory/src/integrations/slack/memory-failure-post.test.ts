import { Agent } from '@mastra/core/agent';
import { AgentController } from '@mastra/core/agent-controller';
import type { AgentChannels } from '@mastra/core/channels';
import { InMemoryStore } from '@mastra/core/storage';
import { MastraLanguageModelV2Mock } from '@mastra/core/test-utils/llm-mock';
import { Workspace } from '@mastra/core/workspace';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { observeSessionMemoryFailurePosts } from './memory-failure-post.js';

/** A real session; only the Slack thread is a fake that records what is posted. */
async function mount({ platform = 'slack' }: { platform?: string } = {}) {
  const storage = new InMemoryStore();
  const agent = new Agent({
    id: 'factory-agent',
    name: 'factory agent',
    instructions: 'You work Factory cards.',
    model: new MastraLanguageModelV2Mock({}),
  });
  const controller = new AgentController({
    workspace: new Workspace({ name: 'test-workspace', skills: ['/tmp/test-skills'] }),
    id: 'code',
    storage,
    modes: [{ id: 'build', name: 'Build', default: true, agent }],
  });
  await controller.init();
  const session = await controller.createSession({ id: 'session-1', resourceId: 'project-1', ownerId: 'user-1' });
  await session.thread.create();
  await session.state.set({ factoryProjectId: 'factory-1' });
  const post = vi.fn(async () => ({}));
  const buildRenderContextForThread = vi.fn(async () => ({ platform, chatThread: { post } }));
  const channels = { buildRenderContextForThread } as unknown as AgentChannels;
  observeSessionMemoryFailurePosts(session, () => channels);
  const run = (chunks: Record<string, unknown>[]) => {
    session.run.ensureAbortController();
    return (session as any).processStream({
      fullStream: (async function* () {
        yield* chunks;
      })(),
    });
  };
  return { session, post, buildRenderContextForThread, run };
}

const observerFailed = {
  type: 'data-om-observation-failed',
  data: { cycleId: 'c1', operationType: 'observation', error: 'You exceeded your current quota', durationMs: 5 },
};

describe('observeSessionMemoryFailurePosts', () => {
  beforeEach(() => {
    vi.stubEnv('MASTRACODE_PUBLIC_URL', 'https://factory.example.com');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('posts the run error card to the Slack thread when a memory failure stops the run', async () => {
    const { session, post, buildRenderContextForThread, run } = await mount();

    await run([observerFailed, { type: 'text-start', payload: { id: 't1' } }]);
    await vi.waitFor(() => expect(post).toHaveBeenCalledTimes(1));

    expect(buildRenderContextForThread).toHaveBeenCalledWith(session.thread.getId());
    const card = JSON.stringify(post.mock.calls[0]);
    expect(card).toContain('Observational memory observation run failed');
    expect(card).toContain('Change memory model');
    expect(card).toContain('https://factory.example.com/factories/factory-1/settings/memory');
  });

  it('posts nothing for a run someone stopped, or on a thread not linked to Slack', async () => {
    const stopped = await mount();
    await stopped.run([{ type: 'abort', payload: {} }]);

    const web = await mount({ platform: 'web' });
    await web.run([observerFailed]);
    await vi.waitFor(() => expect(web.buildRenderContextForThread).toHaveBeenCalled());

    await new Promise(resolve => setTimeout(resolve, 20));
    expect(stopped.post).not.toHaveBeenCalled();
    expect(web.post).not.toHaveBeenCalled();
  });
});
