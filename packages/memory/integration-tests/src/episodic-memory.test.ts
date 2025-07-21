import { randomUUID } from 'node:crypto';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { config } from 'dotenv';
import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { fastembed } from '@mastra/fastembed';
import { LibSQLVector, LibSQLStore } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import { describe, expect, it, beforeEach, afterEach } from 'vitest';

config({ path: '.env.test' });

const resourceId = 'test-resource';

describe('Episodic Memory Integration Tests', () => {
  let memory: Memory;
  let storage: LibSQLStore;
  let vector: LibSQLVector;
  let agent: Agent;

  beforeEach(async () => {
    const dbPath = join(await mkdtemp(join(tmpdir(), `memory-episodic-test-${Date.now()}`)), 'test.db');

    storage = new LibSQLStore({
      url: `file:${dbPath}`,
    });
    vector = new LibSQLVector({
      connectionUrl: `file:${dbPath}`,
    });

    memory = new Memory({
      options: {
        episodicMemory: {
          enabled: true,
          lastEpisodes: 5,
        },
        workingMemory: {
          enabled: true,
          template: `# User Information
- **First Name**: 
- **Last Name**: 
- **Location**: 
`,
        },
        lastMessages: 10,
        semanticRecall: {
          topK: 3,
          messageRange: 2,
        },
        threads: {
          generateTitle: false,
        },
      },
      storage,
      vector,
      embedder: fastembed,
    });

    agent = new Agent({
      name: 'Episodic Memory Test Agent',
      instructions:
        'You are a helpful AI agent. Use episodic memory to remember important events and facts about the user.',
      model: openai('gpt-4o'),
      memory,
    });
  });

  afterEach(async () => {
    //@ts-ignore
    await storage.client.close();
    //@ts-ignore
    await vector.turso.close();
  });

  it('should create an episode through agent conversation', async () => {
    const thread = await memory.createThread({
      threadId: randomUUID(),
      title: 'Episode Test Thread',
      resourceId,
      metadata: {},
    });

    // Have a conversation that should trigger episode creation
    await agent.generate('I just got promoted to Senior Engineering Manager at TechCorp!', {
      threadId: thread.id,
      resourceId,
    });

    // Check if episodes were created
    const episodes = await memory.listEpisodes({ resourceId });
    expect(episodes.length).toBeGreaterThan(0);

    const episode = episodes[0];
    expect(episode.title).toBeTruthy();
    expect(episode.categories).toContain('work');
  });

  it('should use episodes in subsequent conversations', async () => {
    const thread1 = await memory.createThread({
      threadId: randomUUID(),
      title: 'First Thread',
      resourceId,
      metadata: {},
    });

    // Create an episode directly
    await memory.createEpisode({
      resourceId,
      threadId: thread1.id,
      title: 'User loves hiking',
      shortSummary: 'User enjoys hiking in the mountains',
      detailedSummary:
        'The user expressed a deep passion for hiking, particularly in mountainous regions. They mentioned hiking every weekend.',
      categories: ['hobbies', 'outdoor-activities'],
      messageIds: [],
      significance: 0.8,
    });

    // Create a new thread to test episode recall
    const thread2 = await memory.createThread({
      threadId: randomUUID(),
      title: 'Second Thread',
      resourceId,
      metadata: {},
    });

    // Ask about hobbies in the new thread
    const response = await agent.generate('What do you remember about my hobbies?', {
      threadId: thread2.id,
      resourceId,
    });

    expect(response.text.toLowerCase()).toContain('hiking');
  });

  it('should link related episodes', async () => {
    const thread = await memory.createThread({
      threadId: randomUUID(),
      title: 'Relationship Test Thread',
      resourceId,
      metadata: {},
    });

    // Create two related episodes
    const episode1 = await memory.createEpisode({
      resourceId,
      threadId: thread.id,
      title: 'Moved to San Francisco',
      shortSummary: 'User relocated to San Francisco',
      detailedSummary: 'User moved to San Francisco for a new job opportunity.',
      categories: ['life-event', 'location'],
      messageIds: [],
      spatialContext: 'San Francisco, CA',
      significance: 0.9,
    });

    const episode2 = await memory.createEpisode({
      resourceId,
      threadId: thread.id,
      title: 'Started at TechCorp',
      shortSummary: 'User began working at TechCorp',
      detailedSummary: 'User started their new position as Senior Engineer at TechCorp headquarters.',
      categories: ['work', 'life-event'],
      messageIds: [],
      causalContext: 'Moved to SF for this job opportunity',
      spatialContext: 'San Francisco, CA - TechCorp HQ',
      significance: 0.9,
    });

    // Link the episodes
    await memory.linkEpisodes({
      episodeId1: episode1.id,
      episodeId2: episode2.id,
      relationshipType: 'leads-to',
    });

    // Get related episodes
    const related = await memory.getRelatedEpisodes({
      episodeId: episode1.id,
    });

    expect(related).toHaveLength(1);
    expect(related[0].id).toBe(episode2.id);

    // Check that the relationship was stored on episode1
    const updatedEpisode1 = await memory.storage.getEpisodeById({ id: episode1.id });
    expect(updatedEpisode1?.relationships).toHaveLength(1);
    expect(updatedEpisode1?.relationships?.[0]?.episodeId).toBe(episode2.id);
    expect(updatedEpisode1?.relationships?.[0]?.type).toBe('leads-to');
  });

  it('should include episode context in system message', async () => {
    const thread = await memory.createThread({
      threadId: randomUUID(),
      title: 'Context Test Thread',
      resourceId,
      metadata: {},
    });

    // Create an episode with significance
    await memory.createEpisode({
      resourceId,
      threadId: thread.id,
      title: 'Allergic to peanuts',
      shortSummary: 'User has severe peanut allergy',
      detailedSummary: 'User mentioned they have a severe peanut allergy and carry an EpiPen.',
      categories: ['health', 'important'],
      messageIds: [],
      significance: 1.0,
    });

    // Get system message
    const systemMessage = await memory.getSystemMessage({
      threadId: thread.id,
      resourceId,
    });

    expect(systemMessage).toBeTruthy();
    expect(systemMessage!.toLowerCase()).toContain('episodic memory');
    expect(systemMessage!).toContain('peanut');
    expect(systemMessage!).toContain('health, important');
  });

  it('should handle episode sequences', async () => {
    const thread = await memory.createThread({
      threadId: randomUUID(),
      title: 'Sequence Test Thread',
      resourceId,
      metadata: {},
    });

    const sequenceId = randomUUID();

    // Create episodes in a sequence
    await memory.createEpisode({
      resourceId,
      threadId: thread.id,
      title: 'Trip Day 1: Arrived in Paris',
      shortSummary: 'First day of Paris vacation',
      detailedSummary: 'Arrived at Charles de Gaulle airport, checked into hotel near the Eiffel Tower.',
      categories: ['travel', 'vacation'],
      messageIds: [],
      sequenceId,
      spatialContext: 'Paris, France',
      significance: 0.7,
    });

    await memory.createEpisode({
      resourceId,
      threadId: thread.id,
      title: 'Trip Day 2: Louvre Museum',
      shortSummary: 'Visited the Louvre',
      detailedSummary: 'Spent the day at the Louvre Museum, saw the Mona Lisa and other masterpieces.',
      categories: ['travel', 'vacation', 'culture'],
      messageIds: [],
      sequenceId,
      spatialContext: 'Louvre Museum, Paris',
      significance: 0.8,
    });

    // Get episodes in sequence
    const sequenceEpisodes = await memory.getEpisodesInSequence({
      sequenceId,
      resourceId,
    });

    expect(sequenceEpisodes).toHaveLength(2);
    expect(sequenceEpisodes.every(ep => ep.sequenceId === sequenceId)).toBe(true);
  });
});
