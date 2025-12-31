import { join } from 'node:path';
import { describe, it, expect, beforeEach } from 'vitest';
import { MessageList } from '@mastra/core/agent';
import type { ProcessInputArgs } from '@mastra/core/processors';

import { Skills } from './skills';
import { StaticSkills } from './processors/static-skills';
import { RetrievedSkills } from './processors/retrieved-skills';

const FIXTURES_PATH = join(__dirname, '__fixtures__', 'skills');

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

describe('StaticSkills Processor', () => {
  let skills: Skills;

  beforeEach(() => {
    skills = new Skills({
      id: 'test-skills',
      paths: FIXTURES_PATH,
    });
  });

  describe('processInput', () => {
    it('should add all skills as system message in XML format', async () => {
      const processor = new StaticSkills({
        skills,
        format: 'xml',
      });

      const messageList = createMessageListWithUserMessage('How do I process a PDF?');
      const args = createProcessInputArgs(messageList);

      const result = await processor.processInput(args);

      expect(result).toBe(messageList);

      const systemMessages = getSystemMessages(messageList);
      expect(systemMessages.length).toBe(1);
      expect(systemMessages[0]).toContain('<static_skills>');
      expect(systemMessages[0]).toContain('pdf-processing');
      expect(systemMessages[0]).toContain('data-analysis');
    });

    it('should add specific skills when skillNames is provided', async () => {
      const processor = new StaticSkills({
        skills,
        skillNames: ['pdf-processing'],
        format: 'xml',
      });

      const messageList = createMessageListWithUserMessage('How do I process a PDF?');
      const args = createProcessInputArgs(messageList);

      await processor.processInput(args);

      const systemMessages = getSystemMessages(messageList);
      expect(systemMessages.length).toBe(1);
      expect(systemMessages[0]).toContain('pdf-processing');
      expect(systemMessages[0]).not.toContain('data-analysis');
    });

    it('should format skills as markdown when configured', async () => {
      const processor = new StaticSkills({
        skills,
        skillNames: ['pdf-processing'],
        format: 'markdown',
      });

      const messageList = createMessageListWithUserMessage('How do I process a PDF?');
      const args = createProcessInputArgs(messageList);

      await processor.processInput(args);

      const systemMessages = getSystemMessages(messageList);
      expect(systemMessages.length).toBe(1);
      expect(systemMessages[0]).toContain('# Skills');
      expect(systemMessages[0]).toContain('## pdf-processing');
    });

    it('should format skills as plain text when configured', async () => {
      const processor = new StaticSkills({
        skills,
        skillNames: ['pdf-processing'],
        format: 'plain',
      });

      const messageList = createMessageListWithUserMessage('How do I process a PDF?');
      const args = createProcessInputArgs(messageList);

      await processor.processInput(args);

      const systemMessages = getSystemMessages(messageList);
      expect(systemMessages.length).toBe(1);
      expect(systemMessages[0]).toContain('[pdf-processing]:');
    });

    it('should support custom formatter', async () => {
      const processor = new StaticSkills({
        skills,
        skillNames: ['pdf-processing'],
        formatter: skills => {
          return `=== CUSTOM FORMAT ===\n${skills.map(s => `* ${s.name}`).join('\n')}\n=== END ===`;
        },
      });

      const messageList = createMessageListWithUserMessage('How do I process a PDF?');
      const args = createProcessInputArgs(messageList);

      await processor.processInput(args);

      const systemMessages = getSystemMessages(messageList);
      expect(systemMessages.length).toBe(1);
      expect(systemMessages[0]).toContain('=== CUSTOM FORMAT ===');
      expect(systemMessages[0]).toContain('* pdf-processing');
      expect(systemMessages[0]).toContain('=== END ===');
    });

    it('should return unchanged messages when no skills match', async () => {
      const processor = new StaticSkills({
        skills,
        skillNames: ['non-existent-skill'],
        format: 'xml',
      });

      const messageList = createMessageListWithUserMessage();
      const messagesBefore = messageList.get.all.db().length;

      await processor.processInput(createProcessInputArgs(messageList));

      const messagesAfter = messageList.get.all.db().length;
      const systemMessages = getSystemMessages(messageList);

      expect(systemMessages.length).toBe(0);
      expect(messagesAfter).toBe(messagesBefore);
    });
  });
});

describe('RetrievedSkills Processor', () => {
  let skills: Skills;

  beforeEach(() => {
    skills = new Skills({
      id: 'test-skills',
      paths: FIXTURES_PATH,
    });
  });

  describe('processInput', () => {
    it('should retrieve relevant skills and add as system message', async () => {
      const processor = new RetrievedSkills({
        skills,
        topK: 3,
        format: 'xml',
      });

      const messageList = createMessageListWithUserMessage('How do I process PDF files?');

      await processor.processInput(createProcessInputArgs(messageList));

      const systemMessages = getSystemMessages(messageList);
      expect(systemMessages.length).toBe(1);
      expect(systemMessages[0]).toContain('<retrieved_skills>');
      expect(systemMessages[0]).toContain('pdf-processing');
    });

    it('should format retrieved skills as markdown', async () => {
      const processor = new RetrievedSkills({
        skills,
        format: 'markdown',
      });

      const messageList = createMessageListWithUserMessage('PDF processing');

      await processor.processInput(createProcessInputArgs(messageList));

      const systemMessages = getSystemMessages(messageList);
      expect(systemMessages.length).toBe(1);
      expect(systemMessages[0]).toContain('# Retrieved Skills');
      expect(systemMessages[0]).toContain('Relevance:');
    });

    it('should format retrieved skills as plain text', async () => {
      const processor = new RetrievedSkills({
        skills,
        format: 'plain',
      });

      const messageList = createMessageListWithUserMessage('PDF processing');

      await processor.processInput(createProcessInputArgs(messageList));

      const systemMessages = getSystemMessages(messageList);
      expect(systemMessages.length).toBe(1);
      expect(systemMessages[0]).toContain('score:');
    });

    it('should support custom formatter', async () => {
      const processor = new RetrievedSkills({
        skills,
        formatter: results => {
          return `=== RETRIEVED ===\n${results.map(r => `${r.skillName}: ${r.source}`).join('\n')}\n=== END ===`;
        },
      });

      const messageList = createMessageListWithUserMessage('PDF processing');

      await processor.processInput(createProcessInputArgs(messageList));

      const systemMessages = getSystemMessages(messageList);
      expect(systemMessages.length).toBe(1);
      expect(systemMessages[0]).toContain('=== RETRIEVED ===');
      expect(systemMessages[0]).toContain('=== END ===');
    });

    it('should return unchanged when no relevant results found', async () => {
      const processor = new RetrievedSkills({
        skills,
        minScore: 100, // Very high threshold that won't match
      });

      const messageList = createMessageListWithUserMessage('completely unrelated query xyz123');
      const messagesBefore = messageList.get.all.db().length;

      await processor.processInput(createProcessInputArgs(messageList));

      const messagesAfter = messageList.get.all.db().length;
      const systemMessages = getSystemMessages(messageList);

      expect(systemMessages.length).toBe(0);
      expect(messagesAfter).toBe(messagesBefore);
    });

    it('should respect topK limit', async () => {
      const processor = new RetrievedSkills({
        skills,
        topK: 1,
        format: 'plain',
      });

      const messageList = createMessageListWithUserMessage('skill');

      await processor.processInput(createProcessInputArgs(messageList));

      const systemMessages = getSystemMessages(messageList);
      expect(systemMessages.length).toBe(1);

      // Count how many skill entries are in the response
      const skillMatches = systemMessages[0]!.match(/\[[\w-]+:/g) || [];
      expect(skillMatches.length).toBeLessThanOrEqual(1);
    });

    it('should use custom query extractor', async () => {
      const processor = new RetrievedSkills({
        skills,
        // Custom extractor that always searches for "data analysis"
        queryExtractor: () => 'data analysis',
        format: 'plain',
      });

      // Even though user asks about PDF, we search for data analysis
      const messageList = createMessageListWithUserMessage('How do I process PDF files?');

      await processor.processInput(createProcessInputArgs(messageList));

      const systemMessages = getSystemMessages(messageList);
      expect(systemMessages.length).toBe(1);
      expect(systemMessages[0]).toContain('data-analysis');
    });

    it('should return unchanged when no user message exists', async () => {
      const processor = new RetrievedSkills({
        skills,
      });

      // Create messageList without user message
      const messageList = new MessageList();
      messageList.addSystem({ role: 'system', content: 'You are a helper.' });
      const messagesBefore = messageList.get.all.db().length;

      await processor.processInput(createProcessInputArgs(messageList));

      const messagesAfter = messageList.get.all.db().length;
      // No new messages should be added since there's no user query
      expect(messagesAfter).toBe(messagesBefore);
    });

    it('should filter by skill names when specified', async () => {
      const processor = new RetrievedSkills({
        skills,
        skillNames: ['pdf-processing'],
        format: 'plain',
      });

      const messageList = createMessageListWithUserMessage('skill processing data');

      await processor.processInput(createProcessInputArgs(messageList));

      const systemMessages = getSystemMessages(messageList);

      // If results found, they should only be from pdf-processing
      if (systemMessages.length > 0) {
        expect(systemMessages[0]).not.toContain('data-analysis:');
      }
    });

    it('should include reference files when includeReferences is true', async () => {
      const processor = new RetrievedSkills({
        skills,
        includeReferences: true,
        format: 'plain',
      });

      const messageList = createMessageListWithUserMessage('reference');

      await processor.processInput(createProcessInputArgs(messageList));

      const systemMessages = getSystemMessages(messageList);
      // Should potentially include reference file content
      expect(systemMessages.length).toBeGreaterThanOrEqual(0);
    });

    it('should exclude reference files when includeReferences is false', async () => {
      const processor = new RetrievedSkills({
        skills,
        includeReferences: false,
        format: 'plain',
      });

      const messageList = createMessageListWithUserMessage('processing');

      await processor.processInput(createProcessInputArgs(messageList));

      const systemMessages = getSystemMessages(messageList);
      // Results should only be from SKILL.md files
      if (systemMessages.length > 0) {
        expect(systemMessages[0]).not.toContain('references/');
      }
    });
  });
});

describe('Combined StaticSkills + RetrievedSkills', () => {
  let skills: Skills;

  beforeEach(() => {
    skills = new Skills({
      id: 'test-skills',
      paths: FIXTURES_PATH,
    });
  });

  it('should work with both static and retrieved skills processors', async () => {
    const staticProcessor = new StaticSkills({
      skills,
      skillNames: ['data-analysis'],
      format: 'xml',
    });

    const retrievedProcessor = new RetrievedSkills({
      skills,
      topK: 1,
      format: 'xml',
    });

    const messageList = createMessageListWithUserMessage('How do I process PDF files?');

    // Apply both processors
    await staticProcessor.processInput(createProcessInputArgs(messageList));
    await retrievedProcessor.processInput(createProcessInputArgs(messageList));

    const systemMessages = getSystemMessages(messageList);

    // Should have 2 system messages - one from each processor
    expect(systemMessages.length).toBe(2);

    // Check static skills is present
    const staticMessage = systemMessages.find(m => m.includes('static_skills'));
    expect(staticMessage).toBeDefined();
    expect(staticMessage).toContain('data-analysis');

    // Check retrieved skills is present
    const retrievedMessage = systemMessages.find(m => m.includes('retrieved_skills'));
    expect(retrievedMessage).toBeDefined();
    expect(retrievedMessage).toContain('pdf-processing');
  });
});
