import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MessageList } from '@mastra/core/agent';
import { $ } from 'execa';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { clientToolLifecycle } from './shared/client-tool-lifecycle';
import { getPgStorageTests } from './shared/with-pg-storage';

// Ensure environment variables are set
if (!process.env.DB_URL) {
  console.warn('DB_URL not set, using default local PostgreSQL connection');
}

const __dirname = fileURLToPath(import.meta.url);
const connectionString = process.env.DB_URL || 'postgres://postgres:password@localhost:5434/mastra';

describe('PostgreSQL Storage Tests', () => {
  beforeAll(async () => {
    await $({
      cwd: join(__dirname, '..'),
      stdio: 'inherit',
      detached: true,
    })`docker compose up -d postgres --wait`;
  });

  // Pool cleanup is handled inside getPgStorageTests via its own afterAll.
  // This afterAll runs last (vitest runs them in reverse registration order)
  // so by this point all PG pools have been gracefully closed.
  afterAll(async () => {
    return $({
      cwd: join(__dirname, '..'),
    })`docker compose down --volumes postgres`;
  });

  getPgStorageTests(connectionString);

  for (const { mode, readOnly } of [
    { mode: 'normal', readOnly: false },
    { mode: 'read-only', readOnly: true },
  ]) {
    it(`22573 history ${mode} preserves incoming same-ID result`, async () => {
      const fixture = await clientToolLifecycle(connectionString, false);
      try {
        await fixture.agent.generate('Make the client green.', fixture.options);
        await fixture.memory.settled();
        const saved = await fixture.memory.recall({ threadId: fixture.threadId, resourceId: fixture.resourceId });
        const pending = saved.messages.find(message =>
          message.content.parts?.some(part => part.type === 'tool-invocation'),
        );
        expect(pending).toBeDefined();
        const incoming = structuredClone(pending!);
        for (const part of incoming.content.parts ?? []) {
          if (part.type === 'tool-invocation') {
            expect(part.toolInvocation.state).toBe('call');
            part.toolInvocation = {
              ...part.toolInvocation,
              state: 'result',
              result: { color: 'green', confirmation: '22573-client-complete' },
            };
          }
        }
        await fixture.agent.generate([incoming], {
          ...fixture.options,
          memory: { ...fixture.options.memory, options: { readOnly } },
        });
        await fixture.memory.settled();
        const final = await fixture.memory.recall({ threadId: fixture.threadId, resourceId: fixture.resourceId });
        const finalTool = final.messages.find(message => message.id === incoming.id);
        console.log(
          '22573 history evidence',
          JSON.stringify({ readOnly, incoming, prompt: fixture.actorPrompts[1], persisted: finalTool }),
        );
        expect(JSON.stringify(fixture.beforeHistory[1])).toContain('22573-client-complete');
        expect.soft(JSON.stringify(fixture.afterHistory[1])).toContain('22573-client-complete');
        expect(fixture.observerPrompts).toHaveLength(0);
        if (readOnly) {
          expect(final.messages).toEqual(saved.messages);
        } else {
          expect.soft(JSON.stringify(finalTool)).toContain('22573-client-complete');
        }
        expect(JSON.stringify(fixture.actorPrompts[1])).toContain('22573-client-complete');
      } finally {
        await fixture.memory.settled();
        await fixture.storage.close();
      }
    });
  }

  for (const control of [
    'same-ID V2 replacement',
    'unrelated historical messages remain ordered',
    'completed client call buffers on idle',
  ]) {
    it(`22573 control ${control}`, async () => {
      const fixture = await clientToolLifecycle(connectionString, false);
      const idle = fixture.makeAgent(true);
      try {
        await fixture.agent.generate('Make the client green.', fixture.options);
        await fixture.memory.settled();
        const saved = await fixture.memory.recall({ threadId: fixture.threadId, resourceId: fixture.resourceId });
        const pending = saved.messages.find(message =>
          message.content.parts?.some(part => part.type === 'tool-invocation'),
        );
        expect(pending).toBeDefined();
        const incoming = structuredClone(pending!);
        for (const part of incoming.content.parts ?? []) {
          if (part.type === 'tool-invocation') {
            expect(part.toolInvocation.state).toBe('call');
            part.toolInvocation = {
              ...part.toolInvocation,
              state: 'result',
              result: { confirmation: '22573-client-complete' },
            };
          }
        }
        const list = new MessageList({ threadId: fixture.threadId, resourceId: fixture.resourceId });
        list.add(pending!, 'memory');
        list.add(incoming, 'input');
        expect(list.get.all.db()).toHaveLength(1);
        expect(JSON.stringify(list.get.all.db())).toContain('22573-client-complete');
        if (control === 'same-ID V2 replacement') return;

        // No stale duplicate: persist the completed client result before loading history.
        await fixture.memory.saveMessages({ messages: [incoming] });
        const target = control === 'completed client call buffers on idle' ? idle : fixture;
        await target.agent.generate([incoming], fixture.options);
        await target.memory.settled();
        expect(JSON.stringify(fixture.actorPrompts[1])).toContain('22573-client-complete');
        const final = await target.memory.recall({ threadId: fixture.threadId, resourceId: fixture.resourceId });
        expect(final.messages.slice(0, saved.messages.length).map(message => message.id)).toEqual(
          saved.messages.map(message => message.id),
        );
        if (control === 'completed client call buffers on idle') {
          expect(fixture.observerPrompts).toHaveLength(1);
          const store = await fixture.storage.getStore('memory');
          const record = await store!.getObservationalMemory(fixture.threadId, fixture.resourceId);
          expect(record?.bufferedObservationChunks).toHaveLength(1);
        } else {
          expect(fixture.observerPrompts).toHaveLength(0);
        }
      } finally {
        await fixture.memory.settled();
        await idle.memory.settled();
        await fixture.storage.close();
      }
    });
  }

  it.each([0, 1, 100])('22573 safe prefix retains pending suffix across activation with gap %i', async gap => {
    const start = new Date('2026-01-01T00:00:00.000Z').getTime();
    const fixture = await clientToolLifecycle(connectionString, false);
    const idle = fixture.makeAgent(true);
    const activation = fixture.makeAgent(false, 10, 1);
    try {
      await fixture.agent.generate('Completed prefix marker.', fixture.options);
      await fixture.memory.settled();
      const saved = await fixture.memory.recall({ threadId: fixture.threadId, resourceId: fixture.resourceId });
      const pending = saved.messages.find(message =>
        message.content.parts?.some(part => part.type === 'tool-invocation'),
      )!;
      const prefix = saved.messages.find(message => message.role === 'user')!;
      const store = (await fixture.storage.getStore('memory'))!;
      // Import the actual request's messages with historical timestamp edge cases.
      // Upserts preserve createdAt, so remove these isolated fixture rows first.
      prefix.createdAt = new Date(start);
      pending.createdAt = new Date(start + gap);
      await store.deleteMessages([prefix.id, pending.id]);
      await fixture.memory.saveMessages({ messages: [prefix, pending] });
      const dated = await fixture.memory.recall({ threadId: fixture.threadId, resourceId: fixture.resourceId });
      expect(dated.messages.find(message => message.id === prefix.id)?.createdAt.getTime()).toBe(start);
      expect(dated.messages.find(message => message.id === pending.id)?.createdAt.getTime()).toBe(start + gap);
      await idle.agent.generate('Retained suffix marker.', fixture.options);
      await idle.memory.settled();
      const buffered = await store.getObservationalMemory(fixture.threadId, fixture.resourceId);
      expect(JSON.stringify(fixture.observerPrompts)).not.toContain('changeColor');
      expect(JSON.stringify(fixture.observerPrompts)).not.toContain('Retained suffix marker');
      expect(fixture.observerPrompts).toHaveLength(gap > 1 ? 1 : 0);
      expect(buffered?.bufferedObservationChunks?.flatMap(chunk => chunk.messageIds) ?? []).toEqual(
        gap > 1 ? [prefix.id] : [],
      );
      if (gap > 1) {
        await activation.agent.generate([structuredClone(pending)], fixture.options);
        await activation.memory.settled();
        const activated = await store.getObservationalMemory(fixture.threadId, fixture.resourceId);
        expect(activated?.activeObservations).toBeTruthy();
        expect(new Date(activated!.lastObservedAt!).getTime()).toBeLessThan(pending.createdAt.getTime());
        expect(JSON.stringify(fixture.afterHistory.at(-1))).toContain(pending.id);
        expect(JSON.stringify(fixture.afterHistory.at(-1))).toContain('Retained suffix marker.');
      }
      const incoming = structuredClone(pending);
      for (const part of incoming.content.parts ?? []) {
        if (part.type === 'tool-invocation') {
          part.toolInvocation = { ...part.toolInvocation, state: 'result', result: '22573-prefix-complete' };
        }
      }
      await idle.agent.generate([incoming], fixture.options);
      await idle.memory.settled();
      expect(JSON.stringify(fixture.actorPrompts.at(-1))).toContain('22573-prefix-complete');
      expect(JSON.stringify(fixture.observerPrompts.at(-1))).toContain('22573-prefix-complete');
      const final = await fixture.memory.recall({ threadId: fixture.threadId, resourceId: fixture.resourceId });
      expect(JSON.stringify(final.messages.find(message => message.id === pending.id))).toContain(
        '22573-prefix-complete',
      );
    } finally {
      await fixture.memory.settled();
      await idle.memory.settled();
      await activation.memory.settled();
      await fixture.storage.close();
    }
  });

  it('22573 completed follow-up buffers after a deferred pending client call', async () => {
    const fixture = await clientToolLifecycle(connectionString, true);
    try {
      await fixture.agent.generate('Make the client green.', fixture.options);
      await fixture.memory.settled();
      expect(JSON.stringify(fixture.observerPrompts)).not.toContain('changeColor');
      const prefixObservations = fixture.observerPrompts.length;
      const saved = await fixture.memory.recall({ threadId: fixture.threadId, resourceId: fixture.resourceId });
      const incoming = structuredClone(
        saved.messages.find(message => message.content.parts?.some(part => part.type === 'tool-invocation'))!,
      );
      for (const part of incoming.content.parts ?? []) {
        if (part.type === 'tool-invocation') {
          expect(part.toolInvocation.state).toBe('call');
          part.toolInvocation = {
            ...part.toolInvocation,
            state: 'result',
            result: { confirmation: '22573-client-complete' },
          };
        }
      }
      await fixture.agent.generate([incoming], fixture.options);
      await fixture.memory.settled();
      expect(JSON.stringify(fixture.actorPrompts[1])).toContain('22573-client-complete');
      expect(fixture.observerPrompts).toHaveLength(prefixObservations + 1);
      expect(JSON.stringify(fixture.observerPrompts.at(-1))).toContain('22573-client-complete');
      const store = await fixture.storage.getStore('memory');
      const record = await store!.getObservationalMemory(fixture.threadId, fixture.resourceId);
      expect(record?.bufferedObservationChunks).toHaveLength(prefixObservations + 1);
      const final = await fixture.memory.recall({ threadId: fixture.threadId, resourceId: fixture.resourceId });
      expect(JSON.stringify(final.messages.find(message => message.id === incoming.id))).toContain(
        '22573-client-complete',
      );
    } finally {
      await fixture.memory.settled();
      await fixture.storage.close();
    }
  });

  it('22573 idle pending client call persists without observation', async () => {
    const fixture = await clientToolLifecycle(connectionString, true);
    try {
      await fixture.agent.generate('Make the client green.', fixture.options);
      await fixture.memory.settled();
      const saved = await fixture.memory.recall({ threadId: fixture.threadId, resourceId: fixture.resourceId });
      const calls = saved.messages
        .flatMap(message => message.content.parts ?? [])
        .filter(part => part.type === 'tool-invocation');
      expect(calls).toHaveLength(1);
      expect(calls[0]?.toolInvocation.state).toBe('call');
      const store = await fixture.storage.getStore('memory');
      const record = await store!.getObservationalMemory(fixture.threadId, fixture.resourceId);
      console.log(
        '22573 idle evidence',
        JSON.stringify({
          calls,
          observerCalls: fixture.observerPrompts.length,
          buffers: record?.bufferedObservationChunks,
        }),
      );
      const pending = saved.messages.find(message =>
        message.content.parts?.some(part => part.type === 'tool-invocation'),
      )!;
      const prefix = saved.messages.filter(message => message.createdAt.getTime() + 1 < pending.createdAt.getTime());
      expect(record?.bufferedObservationChunks?.flatMap(chunk => chunk.messageIds) ?? []).toEqual(
        prefix.map(message => message.id),
      );
      expect(fixture.observerPrompts).toHaveLength(prefix.length ? 1 : 0);
      expect(JSON.stringify(fixture.observerPrompts)).not.toContain('changeColor');
    } finally {
      await fixture.memory.settled();
      await fixture.storage.close();
    }
  });
});
