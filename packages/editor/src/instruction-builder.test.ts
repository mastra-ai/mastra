import { describe, it, expect, beforeEach } from 'vitest';
import { resolveInstructionBlocks } from './instruction-builder';
import { InMemoryDB } from '@mastra/core/storage';
import { InMemoryPromptBlocksStorage } from '@mastra/core/storage';
import type { AgentInstructionBlock } from '@mastra/core/storage';

describe('resolveInstructionBlocks', () => {
  let db: InMemoryDB;
  let storage: InMemoryPromptBlocksStorage;

  beforeEach(() => {
    db = new InMemoryDB();
    storage = new InMemoryPromptBlocksStorage({ db });
  });

  it('should resolve a static text block', async () => {
    const blocks: AgentInstructionBlock[] = [{ type: 'text', content: 'You are a helpful assistant.' }];
    const result = await resolveInstructionBlocks(blocks, {}, { promptBlocksStorage: storage });
    expect(result).toBe('You are a helpful assistant.');
  });

  it('should resolve a text block with template variables', async () => {
    const blocks: AgentInstructionBlock[] = [{ type: 'text', content: 'Hello {{name}}, your role is {{role}}.' }];
    const result = await resolveInstructionBlocks(
      blocks,
      { name: 'Alice', role: 'admin' },
      { promptBlocksStorage: storage },
    );
    expect(result).toBe('Hello Alice, your role is admin.');
  });

  it('should join multiple text blocks with double newlines', async () => {
    const blocks: AgentInstructionBlock[] = [
      { type: 'text', content: 'First block.' },
      { type: 'text', content: 'Second block.' },
    ];
    const result = await resolveInstructionBlocks(blocks, {}, { promptBlocksStorage: storage });
    expect(result).toBe('First block.\n\nSecond block.');
  });

  it('should skip empty text blocks', async () => {
    const blocks: AgentInstructionBlock[] = [
      { type: 'text', content: 'First.' },
      { type: 'text', content: '   ' },
      { type: 'text', content: 'Third.' },
    ];
    const result = await resolveInstructionBlocks(blocks, {}, { promptBlocksStorage: storage });
    expect(result).toBe('First.\n\nThird.');
  });

  it('should resolve a prompt_block_ref from storage', async () => {
    await storage.create({
      promptBlock: {
        id: 'block-1',
        name: 'Greeting',
        content: 'Welcome to our service.',
      },
    });
    await storage.update({ id: 'block-1', status: 'published' });

    const blocks: AgentInstructionBlock[] = [{ type: 'prompt_block_ref', id: 'block-1' }];
    const result = await resolveInstructionBlocks(blocks, {}, { promptBlocksStorage: storage });
    expect(result).toBe('Welcome to our service.');
  });

  it('should apply template rendering to prompt_block_ref content', async () => {
    await storage.create({
      promptBlock: {
        id: 'block-tmpl',
        name: 'Personalized greeting',
        content: 'Hello {{user.name}}, you have {{user.credits}} credits.',
      },
    });
    await storage.update({ id: 'block-tmpl', status: 'published' });

    const blocks: AgentInstructionBlock[] = [{ type: 'prompt_block_ref', id: 'block-tmpl' }];
    const context = { user: { name: 'Bob', credits: 100 } };
    const result = await resolveInstructionBlocks(blocks, context, { promptBlocksStorage: storage });
    expect(result).toBe('Hello Bob, you have 100 credits.');
  });

  it('should skip a prompt_block_ref that is not found in storage', async () => {
    const blocks: AgentInstructionBlock[] = [
      { type: 'text', content: 'Start.' },
      { type: 'prompt_block_ref', id: 'nonexistent' },
      { type: 'text', content: 'End.' },
    ];
    const result = await resolveInstructionBlocks(blocks, {}, { promptBlocksStorage: storage });
    expect(result).toBe('Start.\n\nEnd.');
  });

  it('should skip a prompt_block_ref with status other than published', async () => {
    await storage.create({
      promptBlock: {
        id: 'draft-block',
        name: 'Draft',
        content: 'Draft content.',
      },
    });

    const blocks: AgentInstructionBlock[] = [{ type: 'prompt_block_ref', id: 'draft-block' }];
    const result = await resolveInstructionBlocks(blocks, {}, { promptBlocksStorage: storage });
    expect(result).toBe('');
  });

  it('should include a prompt_block_ref when rules pass', async () => {
    await storage.create({
      promptBlock: {
        id: 'admin-block',
        name: 'Admin instructions',
        content: 'You have admin privileges.',
        rules: {
          operator: 'AND',
          conditions: [{ field: 'user.role', operator: 'equals', value: 'admin' }],
        },
      },
    });
    await storage.update({ id: 'admin-block', status: 'published' });

    const blocks: AgentInstructionBlock[] = [{ type: 'prompt_block_ref', id: 'admin-block' }];
    const result = await resolveInstructionBlocks(
      blocks,
      { user: { role: 'admin' } },
      { promptBlocksStorage: storage },
    );
    expect(result).toBe('You have admin privileges.');
  });

  it('should exclude a prompt_block_ref when rules fail', async () => {
    await storage.create({
      promptBlock: {
        id: 'admin-block',
        name: 'Admin instructions',
        content: 'You have admin privileges.',
        rules: {
          operator: 'AND',
          conditions: [{ field: 'user.role', operator: 'equals', value: 'admin' }],
        },
      },
    });
    await storage.update({ id: 'admin-block', status: 'published' });

    const blocks: AgentInstructionBlock[] = [{ type: 'prompt_block_ref', id: 'admin-block' }];
    const result = await resolveInstructionBlocks(
      blocks,
      { user: { role: 'viewer' } },
      { promptBlocksStorage: storage },
    );
    expect(result).toBe('');
  });

  it('should mix text and prompt_block_ref references', async () => {
    await storage.create({
      promptBlock: {
        id: 'personality',
        name: 'Personality',
        content: 'Be friendly and concise.',
      },
    });
    await storage.update({ id: 'personality', status: 'published' });

    const blocks: AgentInstructionBlock[] = [
      { type: 'text', content: 'You are an AI assistant.' },
      { type: 'prompt_block_ref', id: 'personality' },
      { type: 'text', content: 'Always respond in {{language}}.' },
    ];
    const result = await resolveInstructionBlocks(blocks, { language: 'English' }, { promptBlocksStorage: storage });
    expect(result).toBe('You are an AI assistant.\n\nBe friendly and concise.\n\nAlways respond in English.');
  });

  // --- Inline prompt_block tests ---

  it('should resolve an inline prompt_block', async () => {
    const blocks: AgentInstructionBlock[] = [
      { type: 'prompt_block', content: 'You are a security-focused assistant.' },
    ];
    const result = await resolveInstructionBlocks(blocks, {}, { promptBlocksStorage: storage });
    expect(result).toBe('You are a security-focused assistant.');
  });

  it('should resolve an inline prompt_block with template variables', async () => {
    const blocks: AgentInstructionBlock[] = [
      { type: 'prompt_block', content: 'Welcome {{user.name}}, your tier is {{user.tier}}.' },
    ];
    const result = await resolveInstructionBlocks(
      blocks,
      { user: { name: 'Eve', tier: 'gold' } },
      { promptBlocksStorage: storage },
    );
    expect(result).toBe('Welcome Eve, your tier is gold.');
  });

  it('should include an inline prompt_block when rules pass', async () => {
    const blocks: AgentInstructionBlock[] = [
      {
        type: 'prompt_block',
        content: 'You have premium access.',
        rules: {
          operator: 'AND',
          conditions: [{ field: 'user.isPremium', operator: 'equals', value: true }],
        },
      },
    ];
    const result = await resolveInstructionBlocks(
      blocks,
      { user: { isPremium: true } },
      { promptBlocksStorage: storage },
    );
    expect(result).toBe('You have premium access.');
  });

  it('should exclude an inline prompt_block when rules fail', async () => {
    const blocks: AgentInstructionBlock[] = [
      {
        type: 'prompt_block',
        content: 'You have premium access.',
        rules: {
          operator: 'AND',
          conditions: [{ field: 'user.isPremium', operator: 'equals', value: true }],
        },
      },
    ];
    const result = await resolveInstructionBlocks(
      blocks,
      { user: { isPremium: false } },
      { promptBlocksStorage: storage },
    );
    expect(result).toBe('');
  });

  it('should mix text, prompt_block_ref, and inline prompt_block', async () => {
    await storage.create({
      promptBlock: {
        id: 'stored-block',
        name: 'Stored personality',
        content: 'Be concise and helpful.',
      },
    });
    await storage.update({ id: 'stored-block', status: 'published' });

    const blocks: AgentInstructionBlock[] = [
      { type: 'text', content: 'You are an AI assistant.' },
      { type: 'prompt_block_ref', id: 'stored-block' },
      {
        type: 'prompt_block',
        content: 'User language: {{language}}.',
        rules: {
          operator: 'AND',
          conditions: [{ field: 'language', operator: 'exists', value: null }],
        },
      },
    ];
    const result = await resolveInstructionBlocks(blocks, { language: 'Spanish' }, { promptBlocksStorage: storage });
    expect(result).toBe('You are an AI assistant.\n\nBe concise and helpful.\n\nUser language: Spanish.');
  });

  it('should handle empty blocks array', async () => {
    const result = await resolveInstructionBlocks([], {}, { promptBlocksStorage: storage });
    expect(result).toBe('');
  });
});
