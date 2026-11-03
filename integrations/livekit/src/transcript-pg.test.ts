import { initializeLogger, llm, voice } from '@livekit/agents';
import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { PostgresStore } from '@mastra/pg';
import { expect, it } from 'vitest';
import { MastraLLM } from './llm-plugin';
import { createLiveKitTranscriptPersistence } from './transcript';

// Point this at a disposable local PostgreSQL database. No provider credentials or voice room needed.
it.skipIf(!process.env.LIVEKIT_TEST_PG_URL)(
  'preserves interrupted-message revisions, identity, and ordering through PostgreSQL Memory recall',
  async () => {
    initializeLogger({ level: 'silent', pretty: false });
    const connectionString = process.env.LIVEKIT_TEST_PG_URL!;
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(new URL(connectionString).hostname)) {
      throw new Error('LIVEKIT_TEST_PG_URL must point to a disposable local PostgreSQL database');
    }
    const storage = new PostgresStore({ id: crypto.randomUUID(), connectionString });
    const readerStorage = new PostgresStore({ id: crypto.randomUUID(), connectionString });
    const memory = new Memory({ storage, options: { semanticRecall: false } });
    const reader = new Memory({ storage: readerStorage, options: { semanticRecall: false } });
    const thread = crypto.randomUUID();
    let persistence: Awaited<ReturnType<typeof createLiveKitTranscriptPersistence>> | undefined;
    try {
      const agent = new Agent({
        id: 'support',
        name: 'Support',
        instructions: 'Help.',
        memory,
        // No generation is requested; this check needs no model credentials or model mock.
        model: 'openai/gpt-4o-mini',
      });
      persistence = await createLiveKitTranscriptPersistence({
        agent,
        sessionId: 'job',
        memory: { thread, resource: 'caller' },
      });
      new MastraLLM({ transcriptPersistence: persistence });
      const session = new voice.AgentSession({});
      persistence.attach(session);
      const commit = (item: llm.ChatMessage) => {
        session.emit(voice.AgentSessionEventTypes.ConversationItemAdded, {
          type: voice.AgentSessionEventTypes.ConversationItemAdded,
          item,
          createdAt: Date.now(),
        });
      };
      for (const [id, role, text] of [
        ['z', 'user', 'First'],
        ['a', 'assistant', 'Interrupted reply'],
        ['m', 'user', 'Third'],
      ] as const) {
        commit(llm.ChatMessage.create({ id, role, content: text, createdAt: 100, interrupted: role === 'assistant' }));
      }
      expect(await persistence.flush()).toEqual({ saved: 3, pending: 0, failed: 0 });
      const initial = (await reader.recall({ threadId: thread, resourceId: 'caller', perPage: false })).messages;
      expect(initial.map(row => row.content.metadata?.liveKitItemId)).toEqual(['z', 'a', 'm']);
      expect(initial.map(row => row.createdAt.getTime())).toEqual([100, 101, 102]);
      expect(initial[1]?.content).toMatchObject({
        parts: [{ type: 'text', text: 'Interrupted reply' }],
        metadata: { interrupted: true, nativeCreatedAt: 100 },
      });

      // Revise a row that is already committed to PostgreSQL, then replay the same native item.
      // Shutdown must flush the revision without duplicating the row or moving it after "Third".
      const resumed = llm.ChatMessage.create({
        id: 'a',
        role: 'assistant',
        content: 'Resumed reply',
        createdAt: 100,
        interrupted: false,
      });
      commit(resumed);
      commit(resumed);
      expect(await persistence.close()).toEqual({ saved: 3, pending: 0, failed: 0 });
      const rows = (await reader.recall({ threadId: thread, resourceId: 'caller', perPage: false })).messages;
      expect(rows.map(row => row.id)).toEqual(initial.map(row => row.id));
      expect(rows.map(row => row.content.metadata?.liveKitItemId)).toEqual(['z', 'a', 'm']);
      expect(rows.map(row => row.createdAt.getTime())).toEqual([100, 101, 102]);
      expect(rows.map(row => row.content.parts[0])).toEqual([
        { type: 'text', text: 'First' },
        { type: 'text', text: 'Resumed reply' },
        { type: 'text', text: 'Third' },
      ]);
      expect(rows[1]?.content.metadata).toMatchObject({ interrupted: false, nativeCreatedAt: 100 });
    } finally {
      try {
        await persistence?.close();
        await memory.deleteThread(thread);
      } finally {
        await Promise.all([storage.close(), readerStorage.close()]);
      }
    }
  },
);
