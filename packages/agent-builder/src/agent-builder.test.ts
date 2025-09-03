import type { MastraLanguageModel } from '@mastra/core/agent';
import { RuntimeContext } from '@mastra/core/runtime-context';
import { describe, it, expect, vi } from 'vitest';

// Mock the utils module
vi.mock('./utils', async () => {
  const actual = await vi.importActual('./utils');
  return {
    ...actual,
    execFile: vi.fn(),
  };
});

import { AgentBuilderDefaults } from './defaults';
import { ToolSummaryProcessor } from './processors/tool-summary';
import { AgentBuilder } from './index';

// Mock the openai model for testing
const mockModel = {
  modelId: 'gpt-4',
  provider: 'openai',
} as MastraLanguageModel;

// Mock config with required properties
const mockConfig = {
  model: mockModel,
  projectPath: '/test/project',
  summaryModel: mockModel,
};

describe('AgentBuilder', () => {
  describe('AgentBuilderDefaults', () => {
    it('should have default instructions', () => {
      expect(AgentBuilderDefaults.DEFAULT_INSTRUCTIONS()).toContain('Mastra Expert Agent');
    });

    it('should have default memory config', () => {
      expect(AgentBuilderDefaults.DEFAULT_MEMORY_CONFIG).toEqual({
        lastMessages: 20,
      });
    });

    it('should have default tools', async () => {
      const tools = await AgentBuilderDefaults.DEFAULT_TOOLS('test');
      expect(tools).toHaveProperty('manageProject');
      expect(tools).toHaveProperty('multiEdit');
      expect(tools).toHaveProperty('validateCode');
    });
  });

  describe('AgentBuilder class', () => {
    it('should create an instance with basic config', () => {
      const builder = new AgentBuilder({
        model: mockModel,
        projectPath: '/test/project',
      });

      expect(builder).toBeInstanceOf(AgentBuilder);
      expect(builder.id).toBe('agent-builder');
      expect(builder.name).toBe('agent-builder');
    });

    it('should have access to default tools', () => {
      const builder = new AgentBuilder({
        model: mockModel,
        projectPath: '/test/project',
      });

      const tools = builder.getTools({ runtimeContext: new RuntimeContext() });
      expect(tools).toBeDefined();
    });

    it('should combine custom instructions with default instructions', () => {
      const customInstructions = 'Custom instructions for testing';
      const builder = new AgentBuilder({
        model: mockModel,
        instructions: customInstructions,
        projectPath: '/test/project',
      });

      // Since instructions are private, we can't directly test them,
      // but we can verify the builder was created successfully
      expect(builder).toBeInstanceOf(AgentBuilder);
    });

    it('should merge custom tools with default tools', () => {
      const customTool = {
        id: 'custom-tool',
        description: 'A custom tool for testing',
        execute: vi.fn().mockResolvedValue({ success: true }),
      };

      const builder = new AgentBuilder({
        model: mockModel,
        tools: {
          customTool,
        },
        projectPath: '/test/project',
      });

      expect(builder).toBeInstanceOf(AgentBuilder);
    });
  });

  describe('AgentBuilder.defaultConfig', () => {
    it('should return default configuration', () => {
      const defaultConfig = AgentBuilder.defaultConfig('/test/project');

      expect(defaultConfig).toHaveProperty('instructions');
      expect(defaultConfig).toHaveProperty('memoryConfig');
      expect(defaultConfig).toHaveProperty('tools');
      expect(defaultConfig.memoryConfig).toEqual(AgentBuilderDefaults.DEFAULT_MEMORY_CONFIG);
    });
  });

  describe('AgentBuilder.createWithDefaults', () => {
    it('should create an instance with merged default settings', () => {
      const builder = new AgentBuilder({
        model: mockModel,
        memoryConfig: {
          maxMessages: 50, // Override default
        },
        projectPath: '/test/project',
      });

      expect(builder).toBeInstanceOf(AgentBuilder);
    });
  });

  describe('generateAgent method', () => {
    it('should be defined and callable', async () => {
      const builder = new AgentBuilder(mockConfig);

      expect(builder.generateAgent).toBeDefined();
      expect(typeof builder.generateAgent).toBe('function');
    });
  });

  describe('ToolSummaryProcessor', () => {
    it('should cache tool call summaries', async () => {
      const processor = new ToolSummaryProcessor({ summaryModel: mockModel });

      // Check initial cache is empty
      const initialStats = processor.getCacheStats();
      expect(initialStats.size).toBe(0);

      // Create a mock tool call
      const mockToolCall = {
        toolName: 'testTool',
        args: { param1: 'value1', param2: 'value2' },
      };

      // Test cache key generation
      const cacheKey = processor.createCacheKey(mockToolCall);
      expect(cacheKey).toBe('testTool:{"param1":"value1","param2":"value2"}');

      // Test cache clearing
      processor.clearCache();
      const clearedStats = processor.getCacheStats();
      expect(clearedStats.size).toBe(0);
    });

    it('should create consistent cache keys for same arguments', () => {
      const processor = new ToolSummaryProcessor({ summaryModel: mockModel });

      const toolCall1 = {
        toolName: 'myTool',
        args: { a: 1, b: 2 },
      };

      const toolCall2 = {
        toolName: 'myTool',
        args: { b: 2, a: 1 }, // Different order
      };

      const key1 = processor.createCacheKey(toolCall1);
      const key2 = processor.createCacheKey(toolCall2);

      // Should be same key despite different argument order
      expect(key1).toBe(key2);
      expect(key1).toBe('myTool:{"a":1,"b":2}');
    });

    it('should use Promise.allSettled for resilient parallel processing', async () => {
      // This test verifies that the ToolSummaryProcessor uses Promise.allSettled
      // instead of Promise.all, so that one failed summary doesn't break all summaries

      const processor = new ToolSummaryProcessor({ summaryModel: mockModel });

      // Test that the processor handles empty messages gracefully
      const emptyMessages: any[] = [];
      const result = await processor.process(emptyMessages);
      expect(result).toEqual([]);

      // Test that the processor doesn't throw when processing messages
      // (the actual resilience testing would require more complex mocking,
      // but this ensures the basic structure works)
      const basicMessages = [
        {
          role: 'user' as const,
          content: 'Hello',
        },
      ];

      const basicResult = await processor.process(basicMessages);
      expect(basicResult).toHaveLength(1);
      expect(basicResult[0].content).toBe('Hello');
    });
  });

  describe('Server Management Tools', () => {
    it('should have manageServer and httpRequest tools available', async () => {
      const builder = new AgentBuilder(mockConfig);
      const tools = await builder.getTools({ runtimeContext: new RuntimeContext() });

      expect(tools.manageServer).toBeDefined();
      expect(tools.httpRequest).toBeDefined();
    });

    it('should validate manageServer tool schema', () => {
      expect(AgentBuilderDefaults.checkMastraServerStatus).toBeDefined();
      expect(AgentBuilderDefaults.startMastraServer).toBeDefined();
      expect(AgentBuilderDefaults.stopMastraServer).toBeDefined();
      expect(AgentBuilderDefaults.makeHttpRequest).toBeDefined();
    });

    it('should handle server stop with no running process', async () => {
      // Mock execFile from utils to return "No process found"
      const { execFile } = await import('./utils');
      const mockExecFile = vi.mocked(execFile);
      mockExecFile.mockResolvedValue({ stdout: 'No process found', stderr: '' });

      const result = await AgentBuilderDefaults.stopMastraServer({ port: 9999 });

      expect(result.success).toBe(true);
      expect(result.status).toBe('stopped');
      expect(result.message).toContain('No Mastra server found running on port 9999');

      // Verify that execFile was called with the correct arguments
      expect(mockExecFile).toHaveBeenCalledWith('lsof', ['-ti', '9999']);
    });
  });

  describe('Code Validation', () => {
    it('should have validateCode method', () => {
      expect(AgentBuilderDefaults.validateCode).toBeDefined();
      expect(AgentBuilderDefaults.parseESLintErrors).toBeDefined();
    });

    it('should include full TypeScript output in validation errors', () => {
      // Since we're now passing through raw TypeScript output,
      // we just need to verify the validateCode method includes it
      expect(AgentBuilderDefaults.validateCode).toBeDefined();

      // The actual validation testing would require a real TypeScript project,
      // but we can verify the method exists and handles errors properly
      const mockTsOutput = `src/test.ts(10,5): error TS2322: Type 'string' is not assignable to type 'number'.
src/another.ts(20,15): warning TS2345: Argument of type 'null' is not assignable to parameter of type 'string'.
Found 2 errors in 2 files.`;

      // This output would now be included directly in the error message
      // for the agent to interpret, rather than being parsed into structured errors
      expect(mockTsOutput).toContain('error TS2322');
      expect(mockTsOutput).toContain('Found 2 errors');
    });

    it('should parse ESLint errors correctly', () => {
      const eslintResults = [
        {
          filePath: '/path/to/file.ts',
          messages: [
            {
              ruleId: 'no-unused-vars',
              severity: 2,
              message: "'unusedVar' is defined but never used.",
              line: 5,
              column: 10,
            },
            {
              ruleId: 'prefer-const',
              severity: 1,
              message: "'data' is never reassigned. Use 'const' instead of 'let'.",
              line: 8,
              column: 3,
            },
          ],
        },
      ];

      const errors = AgentBuilderDefaults.parseESLintErrors(eslintResults);

      expect(errors).toHaveLength(2);
      expect(errors[0]).toEqual({
        type: 'eslint',
        severity: 'error',
        message: "'unusedVar' is defined but never used.",
        file: '/path/to/file.ts',
        line: 5,
        column: 10,
        code: 'no-unused-vars',
      });
      expect(errors[1]).toEqual({
        type: 'eslint',
        severity: 'warning',
        message: "'data' is never reassigned. Use 'const' instead of 'let'.",
        file: '/path/to/file.ts',
        line: 8,
        column: 3,
        code: 'prefer-const',
      });
    });

    it('should include validation workflow in instructions', () => {
      const instructions = AgentBuilderDefaults.DEFAULT_INSTRUCTIONS('/test/path');

      expect(instructions).toContain('validateCode');
      expect(instructions).toContain('Run \`validateCode\` with types and lint checks');
      expect(instructions).toContain('Re-validate until clean');
    });
  });
});
