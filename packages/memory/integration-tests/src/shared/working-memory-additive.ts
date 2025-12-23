/**
 * Test for GitHub Issue #7775: Working Memory Updates Not Always Additive
 * https://github.com/mastra-ai/mastra/issues/7775
 *
 * These tests verify that schema-based working memory uses MERGE semantics (PATCH),
 * preserving existing data when new data is added across multiple conversation turns.
 */
import { randomUUID } from 'node:crypto';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Agent } from '@mastra/core/agent';
import { LibSQLStore } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';
import type { MastraModelConfig } from '@mastra/core/llm';

const resourceId = 'test-resource';

const createTestThread = (title: string, metadata = {}) => ({
  id: randomUUID(),
  title,
  resourceId,
  metadata,
  createdAt: new Date(),
  updatedAt: new Date(),
});

// Helper to determine if model is v5+
function isV5PlusModel(model: MastraModelConfig): boolean {
  if (typeof model === 'string') return true;
  if ('specificationVersion' in model) {
    return model.specificationVersion === 'v2' || model.specificationVersion === 'v3';
  }
  return false;
}

// Helper to call the appropriate generate method based on model version
async function agentGenerate(
  agent: Agent,
  prompt: string,
  options: { threadId: string; resourceId: string },
  isV5: boolean,
) {
  if (isV5) {
    return agent.generate(prompt, options);
  } else {
    return agent.generateLegacy(prompt, options);
  }
}

export function getWorkingMemoryAdditiveTests(model: MastraModelConfig) {
  const isV5 = isV5PlusModel(model);
  const modelName = typeof model === 'string' ? model : (model as any).modelId || 'unknown';

  describe(`Working Memory Additive Updates (${modelName})`, () => {
    let memory: Memory;
    let storage: LibSQLStore;
    let agent: Agent;
    let thread: any;

    describe('Schema-based Working Memory - Merge Semantics', () => {
      const profileSchema = z.object({
        firstName: z.string().optional().describe("The user's first name"),
        lastName: z.string().optional().describe("The user's last name"),
        location: z.string().optional().describe("The user's city or location"),
        occupation: z.string().optional().describe("The user's job or occupation"),
      });

      beforeEach(async () => {
        const dbPath = join(await mkdtemp(join(tmpdir(), `wm-additive-test-${Date.now()}`)), 'test.db');

        storage = new LibSQLStore({
          id: 'additive-test-storage',
          url: `file:${dbPath}`,
        });

        memory = new Memory({
          storage,
          options: {
            workingMemory: {
              enabled: true,
              schema: profileSchema,
            },
            lastMessages: 10,
            generateTitle: false,
          },
        });

        thread = await memory.saveThread({
          thread: createTestThread('Additive Profile Test'),
        });

        agent = new Agent({
          id: 'profile-builder-agent',
          name: 'Profile Builder Agent',
          instructions: `You are a helpful AI assistant that remembers user information.
When users tell you about themselves, update working memory with that information.
You only need to include the fields that have new information - existing data is automatically preserved.`,
          model,
          memory,
        });
      });

      afterEach(async () => {
        // @ts-ignore
        await storage.client.close();
      });

      it('should preserve existing fields when adding new information across turns', async () => {
        // Turn 1: User provides their name
        await agentGenerate(agent, 'Hi, my name is Sarah Johnson.', { threadId: thread.id, resourceId }, isV5);

        // Check that name was saved
        let wmRaw = await memory.getWorkingMemory({ threadId: thread.id, resourceId });
        expect(wmRaw).not.toBeNull();
        expect(wmRaw!.toLowerCase()).toContain('sarah');

        // Turn 2: User provides their location
        await agentGenerate(agent, 'I live in Portland, Oregon.', { threadId: thread.id, resourceId }, isV5);

        // Check working memory again
        wmRaw = await memory.getWorkingMemory({ threadId: thread.id, resourceId });
        expect(wmRaw).not.toBeNull();

        // Location should be added
        expect(wmRaw!.toLowerCase()).toContain('portland');

        // With the fix: name should still be there from the first turn!
        expect(wmRaw!.toLowerCase()).toContain('sarah');
      });

      it('should accumulate profile data across multiple turns', async () => {
        // Turn 1: Name
        await agentGenerate(agent, 'My name is Alex Chen.', { threadId: thread.id, resourceId }, isV5);

        // Turn 2: Occupation
        await agentGenerate(agent, 'I work as a software engineer.', { threadId: thread.id, resourceId }, isV5);

        // Turn 3: Location
        await agentGenerate(agent, "I'm based in Seattle.", { threadId: thread.id, resourceId }, isV5);

        // Get final working memory
        const wmRaw = await memory.getWorkingMemory({ threadId: thread.id, resourceId });
        expect(wmRaw).not.toBeNull();

        // All data should be present from all turns
        expect(wmRaw!.toLowerCase()).toContain('alex');
        expect(wmRaw!.toLowerCase()).toContain('software');
        expect(wmRaw!.toLowerCase()).toContain('seattle');
      });
    });

    describe('Complex Nested Schema - Merge Semantics', () => {
      const userContextSchema = z.object({
        about: z
          .object({
            name: z.string().optional().describe("The user's name"),
            location: z.string().optional().describe("The user's city"),
            timezone: z.string().optional().describe("The user's timezone"),
          })
          .optional()
          .describe('Basic information about the user'),

        work: z
          .object({
            company: z.string().optional().describe('Company name'),
            role: z.string().optional().describe('Job title or role'),
            stage: z.string().optional().describe('Company stage like Series A, B, etc'),
          })
          .optional()
          .describe('Work-related information'),
      });

      beforeEach(async () => {
        const dbPath = join(await mkdtemp(join(tmpdir(), `wm-complex-test-${Date.now()}`)), 'test.db');

        storage = new LibSQLStore({
          id: 'complex-test-storage',
          url: `file:${dbPath}`,
        });

        memory = new Memory({
          storage,
          options: {
            workingMemory: {
              enabled: true,
              schema: userContextSchema,
            },
            lastMessages: 10,
            generateTitle: false,
          },
        });

        thread = await memory.saveThread({
          thread: createTestThread('Complex Schema Test'),
        });

        agent = new Agent({
          id: 'context-agent',
          name: 'Context Agent',
          instructions: `You are a helpful AI assistant that remembers context about the user.
Update working memory with information the user shares.
You only need to include fields that have changed - existing data is automatically preserved via merge.`,
          model,
          memory,
        });
      });

      afterEach(async () => {
        // @ts-ignore
        await storage.client.close();
      });

      it('should preserve about info when adding work info', async () => {
        // Turn 1: User shares basic info
        await agentGenerate(
          agent,
          "I'm Jordan and I live in San Francisco.",
          { threadId: thread.id, resourceId },
          isV5,
        );

        let wmRaw = await memory.getWorkingMemory({ threadId: thread.id, resourceId });
        expect(wmRaw).not.toBeNull();
        expect(wmRaw!.toLowerCase()).toContain('jordan');
        expect(wmRaw!.toLowerCase()).toContain('san francisco');

        // Turn 2: User shares work info (about should be preserved)
        await agentGenerate(
          agent,
          'I work at TechCorp as a senior engineer.',
          { threadId: thread.id, resourceId },
          isV5,
        );

        wmRaw = await memory.getWorkingMemory({ threadId: thread.id, resourceId });
        expect(wmRaw).not.toBeNull();

        // Work info should be added
        expect(wmRaw!.toLowerCase()).toContain('techcorp');

        // About info should be preserved!
        expect(wmRaw!.toLowerCase()).toContain('jordan');
        expect(wmRaw!.toLowerCase()).toContain('san francisco');
      });
    });

    describe('Large Real-World Schema - User Context', () => {
      /**
       * This is the exact schema from the issue reporter
       */
      const userContextSchema = z.object({
        about: z
          .object({
            name: z.string().optional(),
            location: z.string().optional(),
            timezone: z.string().optional(),
            pronouns: z.string().optional(),
          })
          .optional(),

        people: z
          .array(
            z.object({
              contactId: z.string().optional(),
              name: z.string(),
              role: z.string().optional(),
              importance: z.string().optional(),
              tags: z.array(z.string()).optional(),
              notes: z.string().optional(),
            }),
          )
          .optional(),

        work: z
          .object({
            company: z.string().optional(),
            mission: z.string().optional(),
            stage: z.string().optional(),
            website: z.string().optional(),
            niche: z.string().optional(),
            kpis: z
              .array(
                z.object({
                  key: z.string(),
                  value: z.union([z.number(), z.string()]),
                }),
              )
              .optional(),
            blockers: z.array(z.string()).optional(),
            projects: z
              .array(
                z.object({
                  projectId: z.string().optional(),
                  name: z.string(),
                  status: z.string().optional(),
                  goal: z.string().optional(),
                  nextMilestone: z.string().optional(),
                }),
              )
              .optional(),
          })
          .optional(),

        focus: z
          .object({
            today: z.array(z.string()).optional(),
            week: z.array(z.string()).optional(),
            priorities: z.array(z.string()).optional(),
          })
          .optional(),

        comms: z
          .object({
            style: z.string().optional(),
            channels: z.array(z.string()).optional(),
            dnd: z.object({ start: z.string().optional(), end: z.string().optional() }).optional(),
            workHours: z.object({ start: z.string().optional(), end: z.string().optional() }).optional(),
            meetingLengthMins: z.number().optional(),
            reminderLeadMins: z.number().optional(),
          })
          .optional(),

        links: z.array(z.object({ label: z.string(), url: z.string() })).optional(),

        tags: z.array(z.string()).optional(),

        notes: z.string().optional(),

        // Flexible extension bucket for anything not yet modeled
        extra: z.record(z.string(), z.unknown()).optional(),
      });

      beforeEach(async () => {
        const dbPath = join(await mkdtemp(join(tmpdir(), `wm-large-schema-test-${Date.now()}`)), 'test.db');

        storage = new LibSQLStore({
          id: 'large-schema-test-storage',
          url: `file:${dbPath}`,
        });

        memory = new Memory({
          storage,
          options: {
            workingMemory: {
              enabled: true,
              schema: userContextSchema,
            },
            lastMessages: 10,
            generateTitle: false,
          },
        });

        thread = await memory.saveThread({
          thread: createTestThread('Large Schema Test'),
        });

        agent = new Agent({
          id: 'context-agent',
          name: 'User Context Agent',
          instructions: `You are a helpful AI assistant that remembers everything about the user.
Update working memory with any information the user shares.
You only need to include the fields that have new information - existing data is automatically preserved.
Be thorough in capturing details about people, work, and preferences.`,
          model,
          memory,
        });
      });

      afterEach(async () => {
        // @ts-ignore
        await storage.client.close();
      });

      it('should build up a comprehensive user profile across many turns', async () => {
        // Turn 1: Basic about info
        await agentGenerate(
          agent,
          "Hi! I'm Marcus Chen, I'm based in Austin, Texas. My timezone is CST and my pronouns are he/him.",
          { threadId: thread.id, resourceId },
          isV5,
        );

        let wmRaw = await memory.getWorkingMemory({ threadId: thread.id, resourceId });
        expect(wmRaw).not.toBeNull();
        expect(wmRaw!.toLowerCase()).toContain('marcus');
        expect(wmRaw!.toLowerCase()).toContain('austin');

        // Turn 2: Work info
        await agentGenerate(
          agent,
          "I'm the CTO at CloudScale, we're a Series B startup in the cloud infrastructure space. Our website is cloudscale.io and our mission is to simplify cloud deployments.",
          { threadId: thread.id, resourceId },
          isV5,
        );

        wmRaw = await memory.getWorkingMemory({ threadId: thread.id, resourceId });
        expect(wmRaw).not.toBeNull();
        expect(wmRaw!.toLowerCase()).toContain('cloudscale');
        expect(wmRaw!.toLowerCase()).toContain('series b');
        // About info should still be there
        expect(wmRaw!.toLowerCase()).toContain('marcus');
        expect(wmRaw!.toLowerCase()).toContain('austin');

        // Turn 3: Mention some people
        await agentGenerate(
          agent,
          'My co-founder is Sarah Kim, she handles product and is critical. Our lead engineer Dave Martinez is also very important.',
          { threadId: thread.id, resourceId },
          isV5,
        );

        wmRaw = await memory.getWorkingMemory({ threadId: thread.id, resourceId });
        expect(wmRaw).not.toBeNull();
        expect(wmRaw!.toLowerCase()).toContain('sarah');
        expect(wmRaw!.toLowerCase()).toContain('dave');
        // Previous data should still be there
        expect(wmRaw!.toLowerCase()).toContain('marcus');
        expect(wmRaw!.toLowerCase()).toContain('cloudscale');

        // Turn 4: Add project info
        await agentGenerate(
          agent,
          "We're working on Project Phoenix right now - it's our new serverless platform. The goal is to launch by Q2, next milestone is the beta release.",
          { threadId: thread.id, resourceId },
          isV5,
        );

        wmRaw = await memory.getWorkingMemory({ threadId: thread.id, resourceId });
        expect(wmRaw).not.toBeNull();
        expect(wmRaw!.toLowerCase()).toContain('phoenix');
        // All previous data should still be there
        expect(wmRaw!.toLowerCase()).toContain('marcus');
        expect(wmRaw!.toLowerCase()).toContain('cloudscale');
        expect(wmRaw!.toLowerCase()).toContain('sarah');

        // Turn 5: Add focus/priorities
        await agentGenerate(
          agent,
          'Today I need to focus on the investor pitch. This week my priorities are hiring and closing the Series C.',
          { threadId: thread.id, resourceId },
          isV5,
        );

        wmRaw = await memory.getWorkingMemory({ threadId: thread.id, resourceId });
        expect(wmRaw).not.toBeNull();
        expect(wmRaw!.toLowerCase()).toContain('investor');
        expect(wmRaw!.toLowerCase()).toContain('series c');
        // All previous data should still be there
        expect(wmRaw!.toLowerCase()).toContain('marcus');
        expect(wmRaw!.toLowerCase()).toContain('cloudscale');
        expect(wmRaw!.toLowerCase()).toContain('phoenix');

        // Turn 6: Add comms preferences
        await agentGenerate(
          agent,
          'I prefer Slack and email for communication. My work hours are 9am to 6pm, and I like 30 minute meetings.',
          { threadId: thread.id, resourceId },
          isV5,
        );

        wmRaw = await memory.getWorkingMemory({ threadId: thread.id, resourceId });
        expect(wmRaw).not.toBeNull();
        expect(wmRaw!.toLowerCase()).toContain('slack');
        // Verify comprehensive data accumulation - everything should still be there
        expect(wmRaw!.toLowerCase()).toContain('marcus');
        expect(wmRaw!.toLowerCase()).toContain('austin');
        expect(wmRaw!.toLowerCase()).toContain('cloudscale');
        expect(wmRaw!.toLowerCase()).toContain('sarah');
        expect(wmRaw!.toLowerCase()).toContain('phoenix');
      });

      it('should remove fields when user asks to forget something (null delete)', async () => {
        // Turn 1: Set up comprehensive data
        await agentGenerate(
          agent,
          "I'm Jordan Lee, I work at DataCorp. My email contact is jordan@datacorp.com and I'm in Seattle.",
          { threadId: thread.id, resourceId },
          isV5,
        );

        let wmRaw = await memory.getWorkingMemory({ threadId: thread.id, resourceId });

        expect(wmRaw).not.toBeNull();
        expect(wmRaw!.toLowerCase()).toContain('jordan');
        expect(wmRaw!.toLowerCase()).toContain('datacorp');
        expect(wmRaw!.toLowerCase()).toContain('seattle');

        // Turn 2: Ask to forget location for privacy
        await agentGenerate(
          agent,
          'Actually, please forget my location. Remove it from your memory for privacy reasons.',
          { threadId: thread.id, resourceId },
          isV5,
        );

        console.log('Turn 2');

        wmRaw = await memory.getWorkingMemory({ threadId: thread.id, resourceId });

        console.log('wmRaw', wmRaw);

        expect(wmRaw).not.toBeNull();

        // Location should be removed
        expect(wmRaw!.toLowerCase()).not.toContain('seattle');

        // But other data should still be there
        expect(wmRaw!.toLowerCase()).toContain('jordan');
        expect(wmRaw!.toLowerCase()).toContain('datacorp');
      });

      it('should preserve people array when adding work details', async () => {
        // Turn 1: Mention people first
        await agentGenerate(
          agent,
          'I work closely with Alice (my manager), Bob (engineering lead), and Carol (design director).',
          { threadId: thread.id, resourceId },
          isV5,
        );

        let wmRaw = await memory.getWorkingMemory({ threadId: thread.id, resourceId });
        expect(wmRaw).not.toBeNull();
        expect(wmRaw!.toLowerCase()).toContain('alice');
        expect(wmRaw!.toLowerCase()).toContain('bob');
        expect(wmRaw!.toLowerCase()).toContain('carol');

        // Turn 2: Add work details (people should be preserved)
        await agentGenerate(
          agent,
          "We're at TechStartup Inc, a Series A company focused on AI tools.",
          { threadId: thread.id, resourceId },
          isV5,
        );

        wmRaw = await memory.getWorkingMemory({ threadId: thread.id, resourceId });
        expect(wmRaw).not.toBeNull();
        expect(wmRaw!.toLowerCase()).toContain('techstartup');
        expect(wmRaw!.toLowerCase()).toContain('series a');
        // People should still be there!
        expect(wmRaw!.toLowerCase()).toContain('alice');
        expect(wmRaw!.toLowerCase()).toContain('bob');
        expect(wmRaw!.toLowerCase()).toContain('carol');

        // Turn 3: Add about info (people and work should be preserved)
        await agentGenerate(
          agent,
          "By the way, my name is Jamie and I'm in the Seattle area.",
          { threadId: thread.id, resourceId },
          isV5,
        );

        wmRaw = await memory.getWorkingMemory({ threadId: thread.id, resourceId });
        expect(wmRaw).not.toBeNull();
        expect(wmRaw!.toLowerCase()).toContain('jamie');
        expect(wmRaw!.toLowerCase()).toContain('seattle');
        // Everything should still be there
        expect(wmRaw!.toLowerCase()).toContain('techstartup');
        expect(wmRaw!.toLowerCase()).toContain('alice');
        expect(wmRaw!.toLowerCase()).toContain('bob');
      });

      it('should clear work info when user changes jobs', async () => {
        // Turn 1: Set up work info
        await agentGenerate(
          agent,
          "I'm Sam, I work at OldCompany as an engineer. We're working on Project Legacy.",
          { threadId: thread.id, resourceId },
          isV5,
        );

        let wmRaw = await memory.getWorkingMemory({ threadId: thread.id, resourceId });
        expect(wmRaw).not.toBeNull();
        expect(wmRaw!.toLowerCase()).toContain('sam');
        expect(wmRaw!.toLowerCase()).toContain('oldcompany');
        expect(wmRaw!.toLowerCase()).toContain('legacy');

        // Turn 2: User changes jobs - old work info should be cleared
        await agentGenerate(
          agent,
          'I just changed jobs! I now work at NewStartup. Please clear all my old work information - different company, different projects.',
          { threadId: thread.id, resourceId },
          isV5,
        );

        wmRaw = await memory.getWorkingMemory({ threadId: thread.id, resourceId });
        expect(wmRaw).not.toBeNull();

        // New work info should be there
        expect(wmRaw!.toLowerCase()).toContain('newstartup');

        // Old work info should be gone
        expect(wmRaw!.toLowerCase()).not.toContain('oldcompany');
        expect(wmRaw!.toLowerCase()).not.toContain('legacy');

        // About info should still be there
        expect(wmRaw!.toLowerCase()).toContain('sam');
      });

      it('should update people list when team changes', async () => {
        // Turn 1: Set up initial team
        await agentGenerate(agent, 'My team is Alice, Bob, and Charlie.', { threadId: thread.id, resourceId }, isV5);

        let wmRaw = await memory.getWorkingMemory({ threadId: thread.id, resourceId });
        expect(wmRaw).not.toBeNull();
        expect(wmRaw!.toLowerCase()).toContain('alice');
        expect(wmRaw!.toLowerCase()).toContain('bob');
        expect(wmRaw!.toLowerCase()).toContain('charlie');

        // Turn 2: Team changes - replace the people array
        await agentGenerate(
          agent,
          "Update: my team has completely changed. It's now Diana and Eric. Alice, Bob, and Charlie are no longer on my team.",
          { threadId: thread.id, resourceId },
          isV5,
        );

        wmRaw = await memory.getWorkingMemory({ threadId: thread.id, resourceId });
        expect(wmRaw).not.toBeNull();

        // New team should be there
        expect(wmRaw!.toLowerCase()).toContain('diana');
        expect(wmRaw!.toLowerCase()).toContain('eric');

        // Old team should be gone (arrays are replaced, not merged)
        expect(wmRaw!.toLowerCase()).not.toContain('alice');
        expect(wmRaw!.toLowerCase()).not.toContain('bob');
        expect(wmRaw!.toLowerCase()).not.toContain('charlie');
      });
    });
  });
}
