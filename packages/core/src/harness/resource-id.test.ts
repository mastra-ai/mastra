import { describe, it, expect, beforeEach } from 'vitest';
import { Agent } from '../agent';
import { InMemoryStore } from '../storage/mock';
import { Harness } from './harness';

function createAgent() {
  return new Agent({
    name: 'test-agent',
    instructions: 'You are a test agent.',
    model: { provider: 'openai', name: 'gpt-4o', toolChoice: 'auto' },
  });
}

function createHarness(opts?: { resourceId?: string; storage?: InMemoryStore }) {
  const agent = createAgent();
  return new Harness({
    id: 'test-harness',
    storage: opts?.storage ?? new InMemoryStore(),
    modes: [{ id: 'default', name: 'Default', default: true, agent }],
    ...(opts?.resourceId ? { resourceId: opts.resourceId } : {}),
  });
}

describe('Harness resource ID', () => {
  describe('getDefaultResourceId', () => {
    it('returns the harness id when no explicit resourceId is configured', () => {
      const harness = createHarness();
      expect(harness.getDefaultResourceId()).toBe('test-harness');
    });

    it('returns the configured resourceId when one is provided', () => {
      const harness = createHarness({ resourceId: 'custom-resource' });
      expect(harness.getDefaultResourceId()).toBe('custom-resource');
    });

    it('still returns the original default after setResourceId is called', () => {
      const harness = createHarness({ resourceId: 'original' });
      harness.setResourceId({ resourceId: 'changed' });
      expect(harness.getResourceId()).toBe('changed');
      expect(harness.getDefaultResourceId()).toBe('original');
    });
  });

  describe('getKnownResourceIds', () => {
    let storage: InMemoryStore;
    let harness: Harness;

    beforeEach(() => {
      storage = new InMemoryStore();
      harness = createHarness({ storage });
    });

    it('returns an empty array when no threads exist', async () => {
      const ids = await harness.getKnownResourceIds();
      expect(ids).toEqual([]);
    });

    it('returns unique resource IDs from threads', async () => {
      // Create threads under different resource IDs
      await harness.createThread({ title: 'thread-1' });

      harness.setResourceId({ resourceId: 'user-2' });
      await harness.createThread({ title: 'thread-2' });

      harness.setResourceId({ resourceId: 'user-3' });
      await harness.createThread({ title: 'thread-3' });

      const ids = await harness.getKnownResourceIds();
      expect(ids.sort()).toEqual(['test-harness', 'user-2', 'user-3'].sort());
    });

    it('does not return duplicate resource IDs', async () => {
      await harness.createThread({ title: 'thread-1' });
      await harness.createThread({ title: 'thread-2' });

      const ids = await harness.getKnownResourceIds();
      expect(ids).toEqual(['test-harness']);
    });
  });
});
