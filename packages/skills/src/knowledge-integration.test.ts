import { mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { embed } from '@internal/ai-v6';
import { MessageList } from '@mastra/core/agent';
import type { TextArtifact } from '@mastra/core/knowledge';
import type { ProcessInputArgs } from '@mastra/core/processors';
import { fastembed } from '@mastra/fastembed';
import { LibSQLVector } from '@mastra/libsql';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { Knowledge } from './knowledge';
import { StaticKnowledge, RetrievedKnowledge } from './processors';
import { KnowledgeFilesystemStorage as FilesystemStorage } from './storage';

// Default namespace
const NS = 'default';

/**
 * Helper to create a MessageList with a user message for testing processors
 */
function createMessageListWithUserMessage(userMessage: string = 'test input') {
  const messageList = new MessageList();
  messageList.add(
    {
      id: 'msg-1',
      role: 'user',
      content: [{ type: 'text', text: userMessage }],
    },
    'input',
  );
  return messageList;
}

/**
 * Helper to create ProcessInputArgs for testing
 */
function createProcessInputArgs(messageList: MessageList): ProcessInputArgs {
  return {
    messages: messageList.get.all.db(),
    messageList,
    systemMessages: [],
    abort: (reason?: string) => {
      throw new Error(reason ?? 'Aborted');
    },
    retryCount: 0,
  };
}

/**
 * Helper to get the system messages added by a processor
 */
function getSystemMessages(messageList: MessageList): string[] {
  const systemMessages = messageList.getAllSystemMessages();
  return systemMessages.map(m => {
    if (typeof m.content === 'string') {
      return m.content;
    }
    // Handle array content
    if (Array.isArray(m.content)) {
      return m.content
        .filter((p): p is { type: 'text'; text: string } => typeof p === 'object' && p.type === 'text')
        .map(p => p.text)
        .join('');
    }
    return '';
  });
}

describe('StaticKnowledge Processor', () => {
  let testDir: string;
  let knowledge: Knowledge;

  beforeEach(async () => {
    testDir = join(tmpdir(), `knowledge-static-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });

    knowledge = new Knowledge({
      id: 'test-knowledge',
      storage: new FilesystemStorage({ paths: testDir }),
    });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  describe('processInput', () => {
    it('should add static knowledge as system message in XML format', async () => {
      // Add artifacts under static/ prefix
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

      await knowledge.add(NS, faqArtifact);
      await knowledge.add(NS, productArtifact);

      const processor = new StaticKnowledge({
        knowledge,
        namespace: NS,
        format: 'xml',
      });

      const messageList = createMessageListWithUserMessage('What is your refund policy?');
      const args = createProcessInputArgs(messageList);

      const result = await processor.processInput(args);

      expect(result).toBe(messageList);

      const systemMessages = getSystemMessages(messageList);
      expect(systemMessages.length).toBe(1);
      expect(systemMessages[0]).toContain('<static_knowledge>');
      expect(systemMessages[0]).toContain('refund-policy.txt');
      expect(systemMessages[0]).toContain('30 days');
      expect(systemMessages[0]).toContain('sizing.txt');
      expect(systemMessages[0]).toContain('Small, Medium, Large, XL');
    });

    it('should format knowledge as markdown when configured', async () => {
      const artifact: TextArtifact = {
        type: 'text',
        key: 'static/guide.txt',
        content: 'Step 1: Open the app. Step 2: Click start.',
      };

      await knowledge.add(NS, artifact);

      const processor = new StaticKnowledge({
        knowledge,
        namespace: NS,
        format: 'markdown',
      });

      const messageList = createMessageListWithUserMessage('How do I start?');
      const args = createProcessInputArgs(messageList);

      await processor.processInput(args);

      const systemMessages = getSystemMessages(messageList);
      expect(systemMessages.length).toBe(1);
      expect(systemMessages[0]).toContain('# Knowledge Base');
      expect(systemMessages[0]).toContain('## static/guide.txt');
      expect(systemMessages[0]).toContain('Step 1: Open the app');
    });

    it('should format knowledge as plain text when configured', async () => {
      const artifact: TextArtifact = {
        type: 'text',
        key: 'static/info.txt',
        content: 'Plain text content here.',
      };

      await knowledge.add(NS, artifact);

      const processor = new StaticKnowledge({
        knowledge,
        namespace: NS,
        format: 'plain',
      });

      const messageList = createMessageListWithUserMessage();
      const args = createProcessInputArgs(messageList);

      await processor.processInput(args);

      const systemMessages = getSystemMessages(messageList);
      expect(systemMessages.length).toBe(1);
      expect(systemMessages[0]).toContain('[static/info.txt]:');
      expect(systemMessages[0]).toContain('Plain text content here.');
    });

    it('should support custom formatter', async () => {
      const artifact: TextArtifact = {
        type: 'text',
        key: 'static/custom.txt',
        content: 'Custom content here.',
      };

      await knowledge.add(NS, artifact);

      const processor = new StaticKnowledge({
        knowledge,
        namespace: NS,
        formatter: artifacts => {
          return `=== CUSTOM FORMAT ===\n${artifacts.map(a => `* ${a.key}: ${a.content}`).join('\n')}\n=== END ===`;
        },
      });

      const messageList = createMessageListWithUserMessage();
      const args = createProcessInputArgs(messageList);

      await processor.processInput(args);

      const systemMessages = getSystemMessages(messageList);
      expect(systemMessages.length).toBe(1);
      expect(systemMessages[0]).toContain('=== CUSTOM FORMAT ===');
      expect(systemMessages[0]).toContain('* static/custom.txt: Custom content here.');
      expect(systemMessages[0]).toContain('=== END ===');
    });

    it('should dynamically add knowledge by adding to the Knowledge instance', async () => {
      // Add initial static artifact
      await knowledge.add(NS, {
        type: 'text',
        key: 'static/initial.txt',
        content: 'Initial content.',
      });

      const processor = new StaticKnowledge({
        knowledge,
        namespace: NS,
        format: 'plain',
      });

      // First call - should only have initial content
      const messageList1 = createMessageListWithUserMessage();
      await processor.processInput(createProcessInputArgs(messageList1));

      const systemMessages1 = getSystemMessages(messageList1);
      expect(systemMessages1[0]).toContain('Initial content');
      expect(systemMessages1[0]).not.toContain('Dynamically added');

      // Dynamically add more items to knowledge
      await knowledge.add(NS, {
        type: 'text',
        key: 'static/dynamic.txt',
        content: 'Dynamically added content.',
      });

      // Second call - should now include both
      const messageList2 = createMessageListWithUserMessage();
      await processor.processInput(createProcessInputArgs(messageList2));

      const systemMessages2 = getSystemMessages(messageList2);
      expect(systemMessages2[0]).toContain('Initial content');
      expect(systemMessages2[0]).toContain('Dynamically added content');
    });

    it('should not include non-static artifacts', async () => {
      // Add a static artifact
      await knowledge.add(NS, {
        type: 'text',
        key: 'static/public-info.txt',
        content: 'This is public information.',
      });

      // Add a non-static artifact (should NOT be included)
      await knowledge.add(NS, {
        type: 'text',
        key: 'docs/internal.txt',
        content: 'This is internal documentation.',
      });

      const processor = new StaticKnowledge({
        knowledge,
        namespace: NS,
        format: 'plain',
      });

      const messageList = createMessageListWithUserMessage();
      await processor.processInput(createProcessInputArgs(messageList));

      const systemMessages = getSystemMessages(messageList);
      expect(systemMessages.length).toBe(1);
      expect(systemMessages[0]).toContain('public information');
      expect(systemMessages[0]).not.toContain('internal documentation');
    });

    it('should return unchanged messages when no static knowledge exists', async () => {
      // No artifacts added under static/ prefix
      await knowledge.add(NS, {
        type: 'text',
        key: 'docs/not-static.txt',
        content: 'This is not static.',
      });

      const processor = new StaticKnowledge({
        knowledge,
        namespace: NS,
        format: 'xml',
      });

      const messageList = createMessageListWithUserMessage();
      const messagesBefore = messageList.get.all.db().length;

      await processor.processInput(createProcessInputArgs(messageList));

      const messagesAfter = messageList.get.all.db().length;
      const systemMessages = getSystemMessages(messageList);

      // No system messages should be added
      expect(systemMessages.length).toBe(0);
      expect(messagesAfter).toBe(messagesBefore);
    });
  });
});

describe('RetrievedKnowledge Processor', () => {
  let testDir: string;
  let dbPath: string;
  let vectorStore: LibSQLVector;
  let knowledge: Knowledge;
  const indexPrefix = 'retrieved_index';
  const indexName = `${indexPrefix}_${NS}`;
  // bge-small-en-v1.5 produces 384-dimensional embeddings
  const dimension = 384;

  // Use fastembed for real semantic similarity
  const embedder = async (text: string): Promise<number[]> => {
    const result = await embed({ model: fastembed, value: text });
    return result.embedding;
  };

  beforeEach(async () => {
    testDir = join(tmpdir(), `retrieved-knowledge-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(testDir, { recursive: true });

    // Use a file-based SQLite database for each test
    dbPath = join(testDir, 'vectors.db');

    vectorStore = new LibSQLVector({
      connectionUrl: `file:${dbPath}`,
      id: 'retrieved-knowledge-test',
    });

    await vectorStore.createIndex({ indexName, dimension });

    knowledge = new Knowledge({
      id: 'test-knowledge',
      storage: new FilesystemStorage({ paths: testDir }),
      index: {
        vectorStore,
        embedder,
        indexNamePrefix: indexPrefix,
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

  describe('processInput', () => {
    it('should retrieve relevant knowledge and add as system message', async () => {
      // Add documents to knowledge (they get indexed)
      await knowledge.add(NS, {
        type: 'text',
        key: 'docs/password-reset.txt',
        content: 'To reset your password, go to Settings > Security > Reset Password.',
      });
      await knowledge.add(NS, {
        type: 'text',
        key: 'docs/billing-info.txt',
        content: 'To update billing information, go to Account > Billing.',
      });

      const processor = new RetrievedKnowledge({
        knowledge,
        namespace: NS,
        topK: 3,
        format: 'xml',
      });

      const messageList = createMessageListWithUserMessage('How do I reset my password?');

      await processor.processInput(createProcessInputArgs(messageList));

      const systemMessages = getSystemMessages(messageList);
      expect(systemMessages.length).toBe(1);
      expect(systemMessages[0]).toContain('<retrieved_knowledge>');
      expect(systemMessages[0]).toContain('password-reset.txt');
      expect(systemMessages[0]).toContain('Reset Password');
    }, 60000);

    it('should format retrieved knowledge as markdown', async () => {
      await knowledge.add(NS, {
        type: 'text',
        key: 'docs/guide.txt',
        content: 'This is a user guide about password management.',
      });

      const processor = new RetrievedKnowledge({
        knowledge,
        namespace: NS,
        format: 'markdown',
      });

      const messageList = createMessageListWithUserMessage('Tell me about password');

      await processor.processInput(createProcessInputArgs(messageList));

      const systemMessages = getSystemMessages(messageList);
      expect(systemMessages.length).toBe(1);
      expect(systemMessages[0]).toContain('# Retrieved Knowledge');
      expect(systemMessages[0]).toContain('## docs/guide.txt');
      expect(systemMessages[0]).toContain('Relevance:');
    }, 60000);

    it('should format retrieved knowledge as plain text', async () => {
      await knowledge.add(NS, {
        type: 'text',
        key: 'docs/info.txt',
        content: 'Password reset information here.',
      });

      const processor = new RetrievedKnowledge({
        knowledge,
        namespace: NS,
        format: 'plain',
      });

      const messageList = createMessageListWithUserMessage('password reset');

      await processor.processInput(createProcessInputArgs(messageList));

      const systemMessages = getSystemMessages(messageList);
      expect(systemMessages.length).toBe(1);
      expect(systemMessages[0]).toContain('[docs/info.txt]');
      expect(systemMessages[0]).toContain('score:');
    }, 60000);

    it('should support custom formatter', async () => {
      await knowledge.add(NS, {
        type: 'text',
        key: 'docs/custom.txt',
        content: 'Custom content about password reset.',
      });

      const processor = new RetrievedKnowledge({
        knowledge,
        namespace: NS,
        formatter: results => {
          return `=== RETRIEVED ===\n${results.map(r => `${r.key}: ${r.content}`).join('\n')}\n=== END ===`;
        },
      });

      const messageList = createMessageListWithUserMessage('password reset');

      await processor.processInput(createProcessInputArgs(messageList));

      const systemMessages = getSystemMessages(messageList);
      expect(systemMessages.length).toBe(1);
      expect(systemMessages[0]).toContain('=== RETRIEVED ===');
      expect(systemMessages[0]).toContain('docs/custom.txt');
      expect(systemMessages[0]).toContain('=== END ===');
    }, 60000);

    it('should return unchanged when no relevant results found', async () => {
      // Add document about something completely unrelated
      await knowledge.add(NS, {
        type: 'text',
        key: 'docs/recipes.txt',
        content: 'Delicious chocolate cake recipe with vanilla frosting.',
      });

      const processor = new RetrievedKnowledge({
        knowledge,
        namespace: NS,
        minScore: 0.9, // High threshold
      });

      const messageList = createMessageListWithUserMessage('How do I configure my network settings?');
      const messagesBefore = messageList.get.all.db().length;

      await processor.processInput(createProcessInputArgs(messageList));

      const messagesAfter = messageList.get.all.db().length;
      const systemMessages = getSystemMessages(messageList);

      // No system messages should be added since no results meet threshold
      expect(systemMessages.length).toBe(0);
      expect(messagesAfter).toBe(messagesBefore);
    }, 60000);

    it('should respect topK limit', async () => {
      // Add multiple documents
      await knowledge.add(NS, { type: 'text', key: 'doc1.txt', content: 'Password reset guide one.' });
      await knowledge.add(NS, { type: 'text', key: 'doc2.txt', content: 'Password reset guide two.' });
      await knowledge.add(NS, { type: 'text', key: 'doc3.txt', content: 'Password reset guide three.' });

      const processor = new RetrievedKnowledge({
        knowledge,
        namespace: NS,
        topK: 2, // Only get top 2
        format: 'plain',
      });

      const messageList = createMessageListWithUserMessage('password reset');

      await processor.processInput(createProcessInputArgs(messageList));

      const systemMessages = getSystemMessages(messageList);
      expect(systemMessages.length).toBe(1);

      // Count how many documents are in the response
      const docMatches = systemMessages[0]!.match(/doc\d\.txt/g) || [];
      expect(docMatches.length).toBeLessThanOrEqual(2);
    }, 60000);

    it('should use custom query extractor', async () => {
      await knowledge.add(NS, {
        type: 'text',
        key: 'docs/billing.txt',
        content: 'All about billing and payment processing.',
      });

      const processor = new RetrievedKnowledge({
        knowledge,
        namespace: NS,
        // Custom extractor that always searches for "billing"
        queryExtractor: () => 'billing',
        format: 'plain',
      });

      // Even though user asks about password, we search for billing
      const messageList = createMessageListWithUserMessage('How do I reset my password?');

      await processor.processInput(createProcessInputArgs(messageList));

      const systemMessages = getSystemMessages(messageList);
      expect(systemMessages.length).toBe(1);
      expect(systemMessages[0]).toContain('billing.txt');
      expect(systemMessages[0]).toContain('payment processing');
    }, 60000);

    it('should return unchanged when no user message exists', async () => {
      await knowledge.add(NS, {
        type: 'text',
        key: 'docs/test.txt',
        content: 'Test content.',
      });

      const processor = new RetrievedKnowledge({
        knowledge,
        namespace: NS,
      });

      // Create messageList without user message
      const messageList = new MessageList();
      messageList.addSystem({ role: 'system', content: 'You are a helper.' });
      const messagesBefore = messageList.get.all.db().length;

      await processor.processInput(createProcessInputArgs(messageList));

      const messagesAfter = messageList.get.all.db().length;
      // No new messages should be added since there's no user query
      expect(messagesAfter).toBe(messagesBefore);
    }, 60000);
  });
});

describe('RetrievedKnowledge Processor with BM25', () => {
  let testDir: string;
  let knowledge: Knowledge;

  beforeEach(async () => {
    testDir = join(tmpdir(), `retrieved-bm25-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(testDir, { recursive: true });

    knowledge = new Knowledge({
      id: 'test-knowledge',
      storage: new FilesystemStorage({ paths: testDir }),
      bm25: true, // Enable BM25 only
    });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  describe('processInput with BM25 mode', () => {
    it('should retrieve relevant knowledge using BM25 keyword search', async () => {
      await knowledge.add(NS, {
        type: 'text',
        key: 'docs/password-reset.txt',
        content: 'To reset your password, go to Settings > Security > Reset Password.',
      });
      await knowledge.add(NS, {
        type: 'text',
        key: 'docs/billing-info.txt',
        content: 'To update billing information, go to Account > Billing.',
      });

      const processor = new RetrievedKnowledge({
        knowledge,
        namespace: NS,
        topK: 3,
        mode: 'bm25',
        format: 'xml',
      });

      const messageList = createMessageListWithUserMessage('How do I reset my password?');

      await processor.processInput(createProcessInputArgs(messageList));

      const systemMessages = getSystemMessages(messageList);
      expect(systemMessages.length).toBe(1);
      expect(systemMessages[0]).toContain('<retrieved_knowledge>');
      expect(systemMessages[0]).toContain('password-reset.txt');
      expect(systemMessages[0]).toContain('Reset Password');
    });

    it('should use auto-detected mode when not specified', async () => {
      await knowledge.add(NS, {
        type: 'text',
        key: 'docs/guide.txt',
        content: 'This guide explains password management best practices.',
      });

      const processor = new RetrievedKnowledge({
        knowledge,
        namespace: NS,
        // No mode specified - should auto-detect BM25
        format: 'plain',
      });

      const messageList = createMessageListWithUserMessage('password management');

      await processor.processInput(createProcessInputArgs(messageList));

      const systemMessages = getSystemMessages(messageList);
      expect(systemMessages.length).toBe(1);
      expect(systemMessages[0]).toContain('docs/guide.txt');
    });

    it('should return no results for unrelated query', async () => {
      await knowledge.add(NS, {
        type: 'text',
        key: 'docs/recipes.txt',
        content: 'Delicious chocolate cake recipe with vanilla frosting.',
      });

      const processor = new RetrievedKnowledge({
        knowledge,
        namespace: NS,
        mode: 'bm25',
      });

      const messageList = createMessageListWithUserMessage('network configuration settings');
      const messagesBefore = messageList.get.all.db().length;

      await processor.processInput(createProcessInputArgs(messageList));

      const messagesAfter = messageList.get.all.db().length;
      const systemMessages = getSystemMessages(messageList);

      // No system messages should be added
      expect(systemMessages.length).toBe(0);
      expect(messagesAfter).toBe(messagesBefore);
    });
  });
});

describe('RetrievedKnowledge Processor with Hybrid Search', () => {
  let testDir: string;
  let dbPath: string;
  let vectorStore: LibSQLVector;
  let knowledge: Knowledge;
  const indexPrefix = 'hybrid_retrieved_index';
  const indexName = `${indexPrefix}_${NS}`;
  const dimension = 384;

  const embedder = async (text: string): Promise<number[]> => {
    const result = await embed({ model: fastembed, value: text });
    return result.embedding;
  };

  beforeEach(async () => {
    testDir = join(tmpdir(), `retrieved-hybrid-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(testDir, { recursive: true });

    dbPath = join(testDir, 'vectors.db');

    vectorStore = new LibSQLVector({
      connectionUrl: `file:${dbPath}`,
      id: 'retrieved-hybrid-test',
    });

    await vectorStore.createIndex({ indexName, dimension });

    knowledge = new Knowledge({
      id: 'test-knowledge',
      storage: new FilesystemStorage({ paths: testDir }),
      index: {
        vectorStore,
        embedder,
        indexNamePrefix: indexPrefix,
      },
      bm25: true, // Enable both vector and BM25
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

  describe('processInput with hybrid mode', () => {
    it('should retrieve knowledge using hybrid search', async () => {
      await knowledge.add(NS, {
        type: 'text',
        key: 'docs/password-reset.txt',
        content: 'To reset your password, go to Settings > Security > Reset Password.',
      });

      const processor = new RetrievedKnowledge({
        knowledge,
        namespace: NS,
        mode: 'hybrid',
        hybrid: { vectorWeight: 0.7 },
        format: 'xml',
      });

      const messageList = createMessageListWithUserMessage('How do I reset my password?');

      await processor.processInput(createProcessInputArgs(messageList));

      const systemMessages = getSystemMessages(messageList);
      expect(systemMessages.length).toBe(1);
      expect(systemMessages[0]).toContain('<retrieved_knowledge>');
      expect(systemMessages[0]).toContain('password-reset.txt');
    }, 60000);

    it('should use hybrid mode by default when both are configured', async () => {
      await knowledge.add(NS, {
        type: 'text',
        key: 'docs/guide.txt',
        content: 'Password security guide with best practices.',
      });

      const processor = new RetrievedKnowledge({
        knowledge,
        namespace: NS,
        // No mode specified - should auto-detect hybrid
        format: 'plain',
      });

      const messageList = createMessageListWithUserMessage('password security');

      await processor.processInput(createProcessInputArgs(messageList));

      const systemMessages = getSystemMessages(messageList);
      expect(systemMessages.length).toBe(1);
      expect(systemMessages[0]).toContain('docs/guide.txt');
    }, 60000);

    it('should allow explicit vector-only mode in hybrid-capable knowledge', async () => {
      await knowledge.add(NS, {
        type: 'text',
        key: 'docs/semantic.txt',
        content: 'Understanding authentication and access control.',
      });

      const processor = new RetrievedKnowledge({
        knowledge,
        namespace: NS,
        mode: 'vector', // Explicitly use vector only
        format: 'plain',
      });

      const messageList = createMessageListWithUserMessage('login security');

      await processor.processInput(createProcessInputArgs(messageList));

      const systemMessages = getSystemMessages(messageList);
      expect(systemMessages.length).toBe(1);
      expect(systemMessages[0]).toContain('docs/semantic.txt');
    }, 60000);

    it('should allow explicit BM25-only mode in hybrid-capable knowledge', async () => {
      await knowledge.add(NS, {
        type: 'text',
        key: 'docs/keyword.txt',
        content: 'Password reset instructions and guidelines.',
      });

      const processor = new RetrievedKnowledge({
        knowledge,
        namespace: NS,
        mode: 'bm25', // Explicitly use BM25 only
        format: 'plain',
      });

      const messageList = createMessageListWithUserMessage('password reset');

      await processor.processInput(createProcessInputArgs(messageList));

      const systemMessages = getSystemMessages(messageList);
      expect(systemMessages.length).toBe(1);
      expect(systemMessages[0]).toContain('docs/keyword.txt');
    }, 60000);
  });
});

describe('Combined StaticKnowledge + RetrievedKnowledge', () => {
  let testDir: string;
  let dbPath: string;
  let vectorStore: LibSQLVector;
  let knowledge: Knowledge;
  const indexPrefix = 'combined_index';
  const indexName = `${indexPrefix}_${NS}`;
  const dimension = 384;

  const embedder = async (text: string): Promise<number[]> => {
    const result = await embed({ model: fastembed, value: text });
    return result.embedding;
  };

  beforeEach(async () => {
    testDir = join(tmpdir(), `combined-knowledge-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(testDir, { recursive: true });

    dbPath = join(testDir, 'vectors.db');

    vectorStore = new LibSQLVector({
      connectionUrl: `file:${dbPath}`,
      id: 'combined-knowledge-test',
    });

    await vectorStore.createIndex({ indexName, dimension });

    knowledge = new Knowledge({
      id: 'test-knowledge',
      storage: new FilesystemStorage({ paths: testDir }),
      index: {
        vectorStore,
        embedder,
        indexNamePrefix: indexPrefix,
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

  it('should work with both static and retrieved knowledge processors', async () => {
    // Add static knowledge (always injected)
    await knowledge.add(NS, {
      type: 'text',
      key: 'static/company-policy.txt',
      content: 'Our company policy requires all password resets to be verified.',
    });

    // Add indexed knowledge (retrieved on demand)
    await knowledge.add(NS, {
      type: 'text',
      key: 'docs/password-steps.txt',
      content: 'Step 1: Go to settings. Step 2: Click reset password.',
    });

    const staticProcessor = new StaticKnowledge({
      knowledge,
      namespace: NS,
      format: 'xml',
    });

    const retrievedProcessor = new RetrievedKnowledge({
      knowledge,
      namespace: NS,
      format: 'xml',
    });

    const messageList = createMessageListWithUserMessage('How do I reset my password?');

    // Apply both processors
    await staticProcessor.processInput(createProcessInputArgs(messageList));
    await retrievedProcessor.processInput(createProcessInputArgs(messageList));

    const systemMessages = getSystemMessages(messageList);

    // Should have 2 system messages - one from each processor
    expect(systemMessages.length).toBe(2);

    // Check static knowledge is present
    const staticMessage = systemMessages.find(m => m.includes('static_knowledge'));
    expect(staticMessage).toBeDefined();
    expect(staticMessage).toContain('company-policy.txt');

    // Check retrieved knowledge is present
    const retrievedMessage = systemMessages.find(m => m.includes('retrieved_knowledge'));
    expect(retrievedMessage).toBeDefined();
    expect(retrievedMessage).toContain('password-steps.txt');
  }, 60000);
});
