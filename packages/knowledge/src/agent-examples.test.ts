/**
 * Agent Integration Examples
 *
 * These tests demonstrate how to use the Knowledge processors with Agents.
 * They are smoke tests that run the agent and log output - they don't assert
 * on specific LLM responses since those can vary.
 *
 * For unit tests of the processors themselves, see integration.test.ts
 */
import { mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { openai } from '@ai-sdk/openai';
import { embed } from '@internal/ai-v6';
import { Agent } from '@mastra/core/agent';
import type { TextArtifact } from '@mastra/core/knowledge';
import { fastembed } from '@mastra/fastembed';
import { LibSQLVector } from '@mastra/libsql';
import { describe, it, beforeEach, afterEach } from 'vitest';

import { Knowledge } from './knowledge';
import { StaticKnowledge, RetrievedKnowledge } from './processors';
import { FilesystemStorage } from './storage';

describe('Agent with StaticKnowledge Examples', () => {
  let testDir: string;
  let knowledge: Knowledge;

  beforeEach(async () => {
    testDir = join(tmpdir(), `agent-static-example-${Date.now()}`);
    await mkdir(testDir, { recursive: true });

    knowledge = new Knowledge({
      storage: new FilesystemStorage({ namespace: testDir }),
    });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it('should run agent with static knowledge (XML format)', async () => {
    const faqArtifact: TextArtifact = {
      type: 'text',
      key: 'static/refund-policy.txt',
      content: 'All refunds must be processed within 30 days of purchase.',
    };

    const productArtifact: TextArtifact = {
      type: 'text',
      key: 'static/sizing.txt',
      content: 'Our products come in sizes: Small, Medium, Large, XL.',
    };

    await knowledge.add(faqArtifact);
    await knowledge.add(productArtifact);

    const staticKnowledgeProcessor = new StaticKnowledge({
      knowledge,
      format: 'xml',
    });

    const agent = new Agent({
      id: 'support-agent',
      name: 'Support Agent',
      instructions: 'You are a helpful customer support agent.',
      model: openai('gpt-4o'),
      inputProcessors: [staticKnowledgeProcessor],
    });

    const result = await agent.generate('What is your refund policy?');

    console.log('Agent response (static knowledge, XML format):', result.text);
  });

  it('should run agent with static knowledge (markdown format)', async () => {
    const artifact: TextArtifact = {
      type: 'text',
      key: 'static/guide.txt',
      content: 'Step 1: Open the app. Step 2: Click start.',
    };

    await knowledge.add(artifact);

    const processor = new StaticKnowledge({
      knowledge,
      format: 'markdown',
    });

    const agent = new Agent({
      id: 'help-agent',
      name: 'Help Agent',
      instructions: 'You help users.',
      model: openai('gpt-4o'),
      inputProcessors: [processor],
    });

    const result = await agent.generate('How do I start?');

    console.log('Agent response (static knowledge, markdown format):', result.text);
  });

  it('should run agent with custom formatter', async () => {
    const artifact: TextArtifact = {
      type: 'text',
      key: 'static/custom.txt',
      content: 'Custom content here.',
    };

    await knowledge.add(artifact);

    const processor = new StaticKnowledge({
      knowledge,
      formatter: artifacts => {
        return `=== CUSTOM FORMAT ===\n${artifacts.map(a => `* ${a.key}: ${a.content}`).join('\n')}\n=== END ===`;
      },
    });

    const agent = new Agent({
      id: 'custom-agent',
      name: 'Custom Agent',
      instructions: 'You are custom.',
      model: openai('gpt-4o'),
      inputProcessors: [processor],
    });

    const result = await agent.generate('Hello');

    console.log('Agent response (custom formatter):', result.text);
  });
});

describe('Agent with RetrievedKnowledge Examples', () => {
  let testDir: string;
  let dbPath: string;
  let vectorStore: LibSQLVector;
  let knowledge: Knowledge;
  const indexName = 'agent_retrieved_index';
  const dimension = 384;

  const embedder = async (text: string): Promise<number[]> => {
    const result = await embed({ model: fastembed, value: text });
    return result.embedding;
  };

  beforeEach(async () => {
    testDir = join(tmpdir(), `agent-retrieved-example-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(testDir, { recursive: true });

    dbPath = join(testDir, 'vectors.db');

    vectorStore = new LibSQLVector({
      connectionUrl: `file:${dbPath}`,
      id: 'agent-retrieved-example',
    });

    await vectorStore.createIndex({ indexName, dimension });

    knowledge = new Knowledge({
      storage: new FilesystemStorage({ namespace: testDir }),
      index: {
        vectorStore,
        embedder,
        indexName,
      },
    });
  });

  afterEach(async () => {
    try {
      await vectorStore.deleteIndex({ indexName });
    } catch {
      // Ignore cleanup errors
    }
    await rm(testDir, { recursive: true, force: true });
  });

  it('should run agent with retrieved knowledge (XML format)', async () => {
    await knowledge.add({
      type: 'text',
      key: 'docs/password-reset.txt',
      content: 'To reset your password, go to Settings > Security > Reset Password.',
    });
    await knowledge.add({
      type: 'text',
      key: 'docs/billing-info.txt',
      content: 'To update billing information, go to Account > Billing.',
    });

    const processor = new RetrievedKnowledge({
      knowledge,
      topK: 3,
      format: 'xml',
    });

    const agent = new Agent({
      id: 'support-agent',
      name: 'Support Agent',
      instructions: 'You are a helpful support agent.',
      model: openai('gpt-4o'),
      inputProcessors: [processor],
    });

    const result = await agent.generate('How do I reset my password?');

    console.log('Agent response (retrieved knowledge, XML format):', result.text);
  }, 60000);

  it('should run agent with retrieved knowledge (markdown format)', async () => {
    await knowledge.add({
      type: 'text',
      key: 'docs/guide.txt',
      content: 'This is a user guide about password management.',
    });

    const processor = new RetrievedKnowledge({
      knowledge,
      format: 'markdown',
    });

    const agent = new Agent({
      id: 'guide-agent',
      name: 'Guide Agent',
      instructions: 'You help users.',
      model: openai('gpt-4o'),
      inputProcessors: [processor],
    });

    const result = await agent.generate('Tell me about password');

    console.log('Agent response (retrieved knowledge, markdown format):', result.text);
  }, 60000);

  it('should run agent with custom query extractor', async () => {
    await knowledge.add({
      type: 'text',
      key: 'docs/billing.txt',
      content: 'All about billing and payment processing.',
    });

    const processor = new RetrievedKnowledge({
      knowledge,
      queryExtractor: () => 'billing',
      format: 'plain',
    });

    const agent = new Agent({
      id: 'agent',
      name: 'Agent',
      instructions: 'Helper.',
      model: openai('gpt-4o'),
      inputProcessors: [processor],
    });

    // Even though user asks about password, we search for billing
    const result = await agent.generate('How do I reset my password?');

    console.log('Agent response (custom query extractor):', result.text);
  }, 60000);
});

describe('Agent with Hybrid Knowledge Examples', () => {
  let testDir: string;
  let dbPath: string;
  let vectorStore: LibSQLVector;
  let knowledge: Knowledge;
  const indexName = 'agent_hybrid_index';
  const dimension = 384;

  const embedder = async (text: string): Promise<number[]> => {
    const result = await embed({ model: fastembed, value: text });
    return result.embedding;
  };

  beforeEach(async () => {
    testDir = join(tmpdir(), `agent-hybrid-example-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(testDir, { recursive: true });

    dbPath = join(testDir, 'vectors.db');

    vectorStore = new LibSQLVector({
      connectionUrl: `file:${dbPath}`,
      id: 'agent-hybrid-example',
    });

    await vectorStore.createIndex({ indexName, dimension });

    knowledge = new Knowledge({
      storage: new FilesystemStorage({ namespace: testDir }),
      index: {
        vectorStore,
        embedder,
        indexName,
      },
    });
  });

  afterEach(async () => {
    try {
      await vectorStore.deleteIndex({ indexName });
    } catch {
      // Ignore cleanup errors
    }
    await rm(testDir, { recursive: true, force: true });
  });

  it('should run agent with both static and retrieved knowledge', async () => {
    // Add static knowledge (always injected)
    await knowledge.add({
      type: 'text',
      key: 'static/company-policy.txt',
      content: 'Our company policy requires all password resets to be verified.',
    });

    // Add indexed knowledge (retrieved on demand)
    await knowledge.add({
      type: 'text',
      key: 'docs/password-steps.txt',
      content: 'Step 1: Go to settings. Step 2: Click reset password.',
    });

    const staticProcessor = new StaticKnowledge({
      knowledge,
      format: 'xml',
    });

    const retrievedProcessor = new RetrievedKnowledge({
      knowledge,
      format: 'xml',
    });

    const agent = new Agent({
      id: 'hybrid-agent',
      name: 'Hybrid Agent',
      instructions: 'You have both static and retrieved knowledge.',
      model: openai('gpt-4o'),
      inputProcessors: [staticProcessor, retrievedProcessor],
    });

    const result = await agent.generate('How do I reset my password?');

    console.log('Agent response (hybrid knowledge):', result.text);
  }, 60000);
});
