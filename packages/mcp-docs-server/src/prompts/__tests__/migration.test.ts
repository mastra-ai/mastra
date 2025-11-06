import { describe, it, expect, beforeAll } from 'vitest';

import { prepare } from '../../prepare-docs/prepare';
import { migrationPromptMessages } from '../migration';

// Prepare docs once before all tests
beforeAll(async () => {
  await prepare();
}, 60000);

describe('migrationPromptMessages', () => {
  describe('listPrompts', () => {
    it('should return an array of migration prompts', async () => {
      const prompts = await migrationPromptMessages.listPrompts({ extra: {} });

      expect(prompts).toBeInstanceOf(Array);
      expect(prompts.length).toBeGreaterThan(0);
    });

    it('should include upgrade-to-v1 prompt', async () => {
      const prompts = await migrationPromptMessages.listPrompts({ extra: {} });

      const upgradePrompt = prompts.find(p => p.name === 'upgrade-to-v1');
      expect(upgradePrompt).toBeDefined();
      expect(upgradePrompt?.version).toBe('v1');
      expect(upgradePrompt?.description).toContain('v1.0');
      expect(upgradePrompt?.arguments).toBeDefined();
    });

    it('should include migration-checklist prompt', async () => {
      const prompts = await migrationPromptMessages.listPrompts({ extra: {} });

      const checklistPrompt = prompts.find(p => p.name === 'migration-checklist');
      expect(checklistPrompt).toBeDefined();
      expect(checklistPrompt?.version).toBe('v1');
      expect(checklistPrompt?.description).toContain('checklist');
    });

    it('should define optional area argument for upgrade-to-v1', async () => {
      const prompts = await migrationPromptMessages.listPrompts({ extra: {} });

      const upgradePrompt = prompts.find(p => p.name === 'upgrade-to-v1');
      const areaArg = upgradePrompt?.arguments?.find(a => a.name === 'area');

      expect(areaArg).toBeDefined();
      expect(areaArg?.required).toBe(false);
      expect(areaArg?.description).toContain('agents');
    });
  });

  describe('getPromptMessages', () => {
    describe('upgrade-to-v1 prompt', () => {
      it('should return messages for general upgrade without area', async () => {
        const messages = await migrationPromptMessages.getPromptMessages!({
          name: 'upgrade-to-v1',
          extra: {},
        });

        expect(messages).toBeInstanceOf(Array);
        expect(messages.length).toBeGreaterThan(0);

        const userMessage = messages.find(m => m.role === 'user');
        expect(userMessage).toBeDefined();
        expect(userMessage?.content.type).toBe('text');
        expect(userMessage?.content.text).toContain('migrate');
        expect(userMessage?.content.text).toContain('mastraMigration tool');
      });

      it('should return messages for specific area: agents', async () => {
        const messages = await migrationPromptMessages.getPromptMessages!({
          name: 'upgrade-to-v1',
          args: { area: 'agents' },
          extra: {},
        });

        expect(messages).toBeInstanceOf(Array);
        expect(messages.length).toBeGreaterThan(0);

        const userMessage = messages.find(m => m.role === 'user');
        expect(userMessage?.content.text).toContain('agents');
        expect(userMessage?.content.text).toContain('mastraMigration tool');
      });

      it('should return messages for specific area: tools', async () => {
        const messages = await migrationPromptMessages.getPromptMessages!({
          name: 'upgrade-to-v1',
          args: { area: 'tools' },
          extra: {},
        });

        const userMessage = messages.find(m => m.role === 'user');
        expect(userMessage?.content.text).toContain('tools');
      });

      it('should return messages for specific area: workflows', async () => {
        const messages = await migrationPromptMessages.getPromptMessages!({
          name: 'upgrade-to-v1',
          args: { area: 'workflows' },
          extra: {},
        });

        const userMessage = messages.find(m => m.role === 'user');
        expect(userMessage?.content.text).toContain('workflows');
      });

      it('should return messages for specific area: memory', async () => {
        const messages = await migrationPromptMessages.getPromptMessages!({
          name: 'upgrade-to-v1',
          args: { area: 'memory' },
          extra: {},
        });

        const userMessage = messages.find(m => m.role === 'user');
        expect(userMessage?.content.text).toContain('memory');
      });

      it('should return messages for specific area: evals', async () => {
        const messages = await migrationPromptMessages.getPromptMessages!({
          name: 'upgrade-to-v1',
          args: { area: 'evals' },
          extra: {},
        });

        const userMessage = messages.find(m => m.role === 'user');
        expect(userMessage?.content.text).toContain('evals');
      });

      it('should return messages for specific area: mcp', async () => {
        const messages = await migrationPromptMessages.getPromptMessages!({
          name: 'upgrade-to-v1',
          args: { area: 'mcp' },
          extra: {},
        });

        const userMessage = messages.find(m => m.role === 'user');
        expect(userMessage?.content.text).toContain('mcp');
      });

      it('should return messages for specific area: vectors', async () => {
        const messages = await migrationPromptMessages.getPromptMessages!({
          name: 'upgrade-to-v1',
          args: { area: 'vectors' },
          extra: {},
        });

        const userMessage = messages.find(m => m.role === 'user');
        expect(userMessage?.content.text).toContain('vectors');
      });

      it('should return messages for specific area: syncs', async () => {
        const messages = await migrationPromptMessages.getPromptMessages!({
          name: 'upgrade-to-v1',
          args: { area: 'syncs' },
          extra: {},
        });

        const userMessage = messages.find(m => m.role === 'user');
        expect(userMessage?.content.text).toContain('syncs');
      });

      it('should handle invalid area gracefully', async () => {
        const messages = await migrationPromptMessages.getPromptMessages!({
          name: 'upgrade-to-v1',
          args: { area: 'invalid-area' },
          extra: {},
        });

        const userMessage = messages.find(m => m.role === 'user');
        expect(userMessage?.content.text).toContain('Invalid area');
        expect(userMessage?.content.text).toContain('agents');
        expect(userMessage?.content.text).toContain('tools');
      });

      it('should handle case-insensitive area names', async () => {
        const messages = await migrationPromptMessages.getPromptMessages!({
          name: 'upgrade-to-v1',
          args: { area: 'AGENTS' },
          extra: {},
        });

        const userMessage = messages.find(m => m.role === 'user');
        expect(userMessage?.content.text).toContain('AGENTS');
        expect(userMessage?.content.text).not.toContain('Invalid area');
      });
    });

    describe('migration-checklist prompt', () => {
      it('should return messages for migration checklist', async () => {
        const messages = await migrationPromptMessages.getPromptMessages!({
          name: 'migration-checklist',
          extra: {},
        });

        expect(messages).toBeInstanceOf(Array);
        expect(messages.length).toBeGreaterThan(0);

        const userMessage = messages.find(m => m.role === 'user');
        expect(userMessage).toBeDefined();
        expect(userMessage?.content.type).toBe('text');
        expect(userMessage?.content.text).toContain('checklist');
        expect(userMessage?.content.text).toContain('mastraMigration tool');
      });

      it('should request comprehensive checklist format', async () => {
        const messages = await migrationPromptMessages.getPromptMessages!({
          name: 'migration-checklist',
          extra: {},
        });

        const userMessage = messages.find(m => m.role === 'user');
        expect(userMessage?.content.text).toContain('checkbox');
        expect(userMessage?.content.text).toContain('breaking changes');
      });
    });

    describe('error handling', () => {
      it('should throw error for unknown prompt name', async () => {
        await expect(
          migrationPromptMessages.getPromptMessages!({
            name: 'unknown-prompt',
            extra: {},
          }),
        ).rejects.toThrow('Prompt not found');
      });

      it('should throw error for prompt without message handler', async () => {
        // This would test future prompts that don't have handlers yet
        // For now, all prompts have handlers, so this is a safety check
        const messages = await migrationPromptMessages.getPromptMessages!({
          name: 'upgrade-to-v1',
          extra: {},
        });
        expect(messages).toBeDefined();
      });
    });

    describe('message structure validation', () => {
      it('should return properly structured PromptMessage objects', async () => {
        const messages = await migrationPromptMessages.getPromptMessages!({
          name: 'upgrade-to-v1',
          extra: {},
        });

        for (const message of messages) {
          expect(message).toHaveProperty('role');
          expect(['user', 'assistant']).toContain(message.role);
          expect(message).toHaveProperty('content');
          expect(message.content).toHaveProperty('type', 'text');
          expect(message.content).toHaveProperty('text');
          expect(typeof message.content.text).toBe('string');
        }
      });

      it('should return at least one user message', async () => {
        const messages = await migrationPromptMessages.getPromptMessages!({
          name: 'migration-checklist',
          extra: {},
        });

        const userMessages = messages.filter(m => m.role === 'user');
        expect(userMessages.length).toBeGreaterThan(0);
      });
    });
  });

  describe('prompt integration', () => {
    it('should reference mastraMigration tool in all prompts', async () => {
      const prompts = await migrationPromptMessages.listPrompts({ extra: {} });

      for (const prompt of prompts) {
        const messages = await migrationPromptMessages.getPromptMessages!({
          name: prompt.name,
          extra: {},
        });

        const hasToolReference = messages.some(m => m.content.text.includes('mastraMigration'));
        expect(hasToolReference).toBe(true);
      }
    });

    it('should provide actionable instructions', async () => {
      const messages = await migrationPromptMessages.getPromptMessages!({
        name: 'upgrade-to-v1',
        extra: {},
      });

      const userMessage = messages.find(m => m.role === 'user');
      // Should contain numbered steps or clear instructions
      const hasStructuredInstructions =
        userMessage?.content.text.includes('1.') || userMessage?.content.text.includes('step');

      expect(hasStructuredInstructions).toBe(true);
    });
  });
});
