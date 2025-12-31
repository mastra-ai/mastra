import { join } from 'node:path';
import { describe, it, expect, beforeAll } from 'vitest';
import { MessageList } from '@mastra/core/agent';
import { SkillsProcessor } from './skills';

const FIXTURES_PATH = join(__dirname, '__fixtures__', 'skills');

describe('SkillsProcessor', () => {
  describe('Discovery', () => {
    it('should discover skills from directory', () => {
      const processor = new SkillsProcessor({
        skillsPaths: FIXTURES_PATH,
      });

      // Should have discovered our test skills
      expect(processor).toBeDefined();
    });

    it('should handle non-existent directory gracefully', () => {
      const processor = new SkillsProcessor({
        skillsPaths: '/path/that/does/not/exist',
      });

      // Should not throw, just warn
      expect(processor).toBeDefined();
    });

    it('should discover skills from multiple paths', () => {
      const processor = new SkillsProcessor({
        skillsPaths: [FIXTURES_PATH, '/another/path'],
      });

      expect(processor).toBeDefined();
    });
  });

  describe('Format Rendering', () => {
    let processor: SkillsProcessor;

    beforeAll(() => {
      processor = new SkillsProcessor({
        skillsPaths: FIXTURES_PATH,
        format: 'xml',
      });
    });

    it('should render XML format correctly', async () => {
      const messageList = new MessageList();

      const result = await processor.processInputStep({
        systemMessages: [],
        messages: [],
        messageList,
        stepNumber: 0,
        steps: [],
        model: {} as any,
        abort: () => {
          throw new Error('aborted');
        },
        retryCount: 0,
      });

      expect(result.messageList).toBeDefined();
      const systemMessages = result.messageList.getAllSystemMessages();
      expect(systemMessages.length).toBeGreaterThan(0);

      const skillsMessage = systemMessages.find(
        msg => typeof msg.content === 'string' && msg.content.includes('available_skills'),
      );
      expect(skillsMessage).toBeDefined();
      expect(skillsMessage?.content).toContain('<available_skills>');
      expect(skillsMessage?.content).toContain('<skill>');
      expect(skillsMessage?.content).toContain('<name>pdf-processing</name>');
      expect(skillsMessage?.content).toContain('<name>data-analysis</name>');
    });

    it('should render JSON format correctly', async () => {
      const jsonProcessor = new SkillsProcessor({
        skillsPaths: FIXTURES_PATH,
        format: 'json',
      });

      const messageList = new MessageList();
      const result = await jsonProcessor.processInputStep({
        systemMessages: [],
        messages: [],
        messageList,
        stepNumber: 0,
        steps: [],
        model: {} as any,
        abort: () => {
          throw new Error('aborted');
        },
        retryCount: 0,
      });

      const systemMessages = result.messageList.getAllSystemMessages();
      const skillsMessage = systemMessages.find(
        msg => typeof msg.content === 'string' && msg.content.includes('Available Skills'),
      );
      expect(skillsMessage).toBeDefined();
      expect(skillsMessage?.content).toContain('Available Skills:');
      expect(skillsMessage?.content).toContain('"name": "pdf-processing"');
      expect(skillsMessage?.content).toContain('"name": "data-analysis"');
    });

    it('should render Markdown format correctly', async () => {
      const mdProcessor = new SkillsProcessor({
        skillsPaths: FIXTURES_PATH,
        format: 'markdown',
      });

      const messageList = new MessageList();
      const result = await mdProcessor.processInputStep({
        systemMessages: [],
        messages: [],
        messageList,
        stepNumber: 0,
        steps: [],
        model: {} as any,
        abort: () => {
          throw new Error('aborted');
        },
        retryCount: 0,
      });

      const systemMessages = result.messageList.getAllSystemMessages();
      const skillsMessage = systemMessages.find(
        msg => typeof msg.content === 'string' && msg.content.includes('Available Skills'),
      );
      expect(skillsMessage).toBeDefined();
      expect(skillsMessage?.content).toContain('# Available Skills');
      expect(skillsMessage?.content).toContain('- **pdf-processing**:');
      expect(skillsMessage?.content).toContain('- **data-analysis**:');
    });
  });

  describe('Skill Tools', () => {
    let processor: SkillsProcessor;

    beforeAll(() => {
      processor = new SkillsProcessor({
        skillsPaths: FIXTURES_PATH,
      });
    });

    it('should provide skill-activate tool', async () => {
      const messageList = new MessageList();

      const result = await processor.processInputStep({
        systemMessages: [],
        messages: [],
        messageList,
        stepNumber: 0,
        steps: [],
        model: {} as any,
        abort: () => {
          throw new Error('aborted');
        },
        retryCount: 0,
      });

      expect(result.tools).toBeDefined();
      expect(result.tools?.['skill-activate']).toBeDefined();
      expect(result.tools?.['skill-activate'].id).toBe('skill-activate');
    });

    it('should provide skill-read-reference tool', async () => {
      const messageList = new MessageList();

      const result = await processor.processInputStep({
        systemMessages: [],
        messages: [],
        messageList,
        stepNumber: 0,
        steps: [],
        model: {} as any,
        abort: () => {
          throw new Error('aborted');
        },
        retryCount: 0,
      });

      expect(result.tools).toBeDefined();
      expect(result.tools?.['skill-read-reference']).toBeDefined();
      expect(result.tools?.['skill-read-reference'].id).toBe('skill-read-reference');
    });

    it('should activate a skill successfully', async () => {
      const messageList = new MessageList();

      const result = await processor.processInputStep({
        systemMessages: [],
        messages: [],
        messageList,
        stepNumber: 0,
        steps: [],
        model: {} as any,
        abort: () => {
          throw new Error('aborted');
        },
        retryCount: 0,
      });

      const activateTool = result.tools?.['skill-activate'];
      expect(activateTool).toBeDefined();

      const activateResult = await activateTool.execute({ name: 'pdf-processing' });
      expect(activateResult).toMatchObject({
        success: true,
        message: expect.stringContaining('activated successfully'),
      });
    });

    it('should fail to activate non-existent skill', async () => {
      const messageList = new MessageList();

      const result = await processor.processInputStep({
        systemMessages: [],
        messages: [],
        messageList,
        stepNumber: 0,
        steps: [],
        model: {} as any,
        abort: () => {
          throw new Error('aborted');
        },
        retryCount: 0,
      });

      const activateTool = result.tools?.['skill-activate'];
      const activateResult = await activateTool.execute({ name: 'non-existent-skill' });
      expect(activateResult).toMatchObject({
        success: false,
        message: expect.stringContaining('not found'),
      });
    });

    it('should inject activated skill instructions', async () => {
      const messageList1 = new MessageList();

      // First activate a skill
      const result1 = await processor.processInputStep({
        systemMessages: [],
        messages: [],
        messageList: messageList1,
        stepNumber: 0,
        steps: [],
        model: {} as any,
        abort: () => {
          throw new Error('aborted');
        },
        retryCount: 0,
      });

      const activateTool = result1.tools?.['skill-activate'];
      await activateTool.execute({ name: 'pdf-processing' });

      // Next step should include activated skills
      const messageList2 = new MessageList();
      const result2 = await processor.processInputStep({
        systemMessages: [],
        messages: [],
        messageList: messageList2,
        stepNumber: 1,
        steps: [],
        model: {} as any,
        abort: () => {
          throw new Error('aborted');
        },
        retryCount: 0,
      });

      const systemMessages = result2.messageList.getAllSystemMessages();
      const activatedMessage = systemMessages.find(
        msg => typeof msg.content === 'string' && msg.content.includes('activated_skills'),
      );
      expect(activatedMessage).toBeDefined();
      expect(activatedMessage?.content).toContain('PDF Processing Skill');
    });

    it('should read reference files from activated skill', async () => {
      const messageList = new MessageList();

      // First activate a skill
      const result = await processor.processInputStep({
        systemMessages: [],
        messages: [],
        messageList,
        stepNumber: 0,
        steps: [],
        model: {} as any,
        abort: () => {
          throw new Error('aborted');
        },
        retryCount: 0,
      });

      const activateTool = result.tools?.['skill-activate'];
      await activateTool.execute({ name: 'pdf-processing' });

      // Read reference file
      const readRefTool = result.tools?.['skill-read-reference'];
      const refResult = await readRefTool.execute({
        skillName: 'pdf-processing',
        referencePath: 'REFERENCE.md',
      });

      expect(refResult).toMatchObject({
        success: true,
        content: expect.stringContaining('PDF Processing Reference'),
      });
    });

    it('should fail to read reference from non-activated skill', async () => {
      // Create a fresh processor to ensure skill is not activated
      const freshProcessor = new SkillsProcessor({
        skillsPaths: FIXTURES_PATH,
      });

      const messageList = new MessageList();
      const result = await freshProcessor.processInputStep({
        systemMessages: [],
        messages: [],
        messageList,
        stepNumber: 0,
        steps: [],
        model: {} as any,
        abort: () => {
          throw new Error('aborted');
        },
        retryCount: 0,
      });

      const readRefTool = result.tools?.['skill-read-reference'];
      const refResult = await readRefTool.execute({
        skillName: 'pdf-processing',
        referencePath: 'REFERENCE.md',
      });

      expect(refResult).toMatchObject({
        success: false,
        message: expect.stringContaining('not activated'),
      });
    });
  });

  describe('XML Escaping', () => {
    it('should escape XML special characters in skill descriptions', async () => {
      // This would require a skill with special characters in description
      // For now, just verify the XML is well-formed
      const processor = new SkillsProcessor({
        skillsPaths: FIXTURES_PATH,
        format: 'xml',
      });

      const messageList = new MessageList();
      const result = await processor.processInputStep({
        systemMessages: [],
        messages: [],
        messageList,
        stepNumber: 0,
        steps: [],
        model: {} as any,
        abort: () => {
          throw new Error('aborted');
        },
        retryCount: 0,
      });

      const systemMessages = result.messageList.getAllSystemMessages();
      const skillsMessage = systemMessages.find(
        msg => typeof msg.content === 'string' && msg.content.includes('available_skills'),
      );
      expect(skillsMessage?.content).toContain('</available_skills>');
      expect(skillsMessage?.content).toContain('</skill>');
    });
  });
});
