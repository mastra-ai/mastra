import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { initializeLogger, llm, voice } from '@livekit/agents';
import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { PostgresStore } from '@mastra/pg';
import { expect, it } from 'vitest';
import { MastraLLM } from './llm-plugin';
import { createLiveKitTranscriptPersistence } from './transcript';

// Point this at a disposable local PostgreSQL database. No provider credentials or voice room needed.
it.skipIf(!process.env.LIVEKIT_TEST_PG_URL)(
  'preserves ordering and upserts through real PostgreSQL Memory recall',
  async () => {
    initializeLogger({ level: 'silent', pretty: false });
    const storage = new PostgresStore({ id: crypto.randomUUID(), connectionString: process.env.LIVEKIT_TEST_PG_URL! });
    const memory = new Memory({ storage, options: { semanticRecall: false } });
    const thread = crypto.randomUUID();
    const agent = new Agent({
      id: 'support',
      name: 'Support',
      instructions: 'Help.',
      memory,
      model: new MockLanguageModelV2(),
    });
    const persistence = await createLiveKitTranscriptPersistence({
      agent,
      sessionId: 'job',
      memory: { thread, resource: 'caller' },
    });
    new MastraLLM({ transcriptPersistence: persistence });
    const session = new voice.AgentSession({});
    persistence.attach(session);
    try {
      for (const [id, role, text] of [
        ['z', 'user', 'First'],
        ['a', 'assistant', 'Second'],
        ['m', 'user', 'Third'],
        ['a', 'assistant', 'Revised'],
      ] as const) {
        const item = llm.ChatMessage.create({ id, role, content: text, createdAt: 100 });
        session.emit(voice.AgentSessionEventTypes.ConversationItemAdded, {
          type: voice.AgentSessionEventTypes.ConversationItemAdded,
          item,
          createdAt: Date.now(),
        });
      }
      expect(await persistence.flush()).toEqual({ saved: 3, pending: 0, failed: 0 });
      const rows = (await memory.recall({ threadId: thread, resourceId: 'caller' })).messages;
      expect(rows.map(row => row.content.metadata?.liveKitItemId)).toEqual(['z', 'a', 'm']);
      expect(rows.map(row => row.createdAt.getTime())).toEqual([100, 101, 102]);
      expect(rows[1]?.content.parts[0]).toMatchObject({ text: 'Revised' });
    } finally {
      await persistence.close();
      await memory.deleteThread(thread);
      await storage.close();
    }
  },
);
