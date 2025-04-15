import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { callTool, mcp } from './test-setup';

describe('examplesTool', () => {
  let tools: any;

  beforeAll(async () => {
    tools = await mcp.getTools();
  });

  afterAll(async () => {
    await mcp.disconnect();
  });

  describe('execute', () => {
    it('should list all available examples when no example is specified', async () => {
      const result = await callTool(tools.mastra_mastraExamples, {});

      // Check for some known examples that should be in the list
      expect(result).toContain('Available code examples:');
      expect(result).toContain('quick-start');
      expect(result).toContain('agent');
    });

    it('should return example content for a specific example', async () => {
      const result = await callTool(tools.mastra_mastraExamples, { example: 'quick-start' });

      // The example should contain package.json and index.ts files
      expect(result).toContain('### package.json');
      expect(result).toContain('### index.ts');
      expect(result).toContain('```typescript');
    });

    it('should handle examples with or without .md extension', async () => {
      const result1 = await callTool(tools.mastra_mastraExamples, { example: 'quick-start' });
      const result2 = await callTool(tools.mastra_mastraExamples, { example: 'quick-start.md' });

      expect(result1).toBe(result2);
    });

    it('should handle non-existent examples gracefully', async () => {
      const result = await callTool(tools.mastra_mastraExamples, { example: 'non-existent-example' });

      expect(result).toContain('Example "non-existent-example.md" not found');
      expect(result).toContain('Available examples:');
      expect(result).toContain('quick-start'); // Should list available examples
    });

    it('should return examples in alphabetical order', async () => {
      const result = await callTool(tools.mastra_mastraExamples, {});
      const lines = result.split('\n').filter(line => line.startsWith('- '));
      const examples = lines.map(line => line.replace('- ', ''));

      // Check if the array is sorted
      const sortedExamples = [...examples].sort();
      expect(examples).toEqual(sortedExamples);
    });

    it('should handle examples with special characters in names', async () => {
      const result = await callTool(tools.mastra_mastraExamples, { example: 'bird-checker-with-express' });
      expect(result).toContain('### package.json');
      expect(result).toContain('### index.ts');
      expect(result).toContain('```typescript');
    });

    it('should handle examples with multiple code blocks', async () => {
      const result = await callTool(tools.mastra_mastraExamples, { example: 'agent' });
      const codeBlockCount = (result.match(/```typescript/g) || []).length;
      expect(codeBlockCount).toBeGreaterThan(1);
    });

    it('should handle examples with multiple file structures', async () => {
      const result = await callTool(tools.mastra_mastraExamples, { example: 'bird-checker-with-nextjs' });

      // Check for multiple file references
      expect(result).toMatch(/lib\/mastra/i); // Check for lib directory
      expect(result).toMatch(/mastra\/agents/i); // Check for agents directory
      expect(result).toMatch(/mastra\/tools/i); // Check for tools directory
      expect(result).toMatch(/package\.json/i); // Check for package.json
    });

    it('should include TypeScript type definitions', async () => {
      const result = await callTool(tools.mastra_mastraExamples, { example: 'agent-network' });

      // Check for TypeScript types and interfaces
      expect(result).toMatch(/import\s+{\s*Agent\s*}\s+from/i); // Type import
      expect(result).toMatch(/import\s+{\s*AgentNetwork\s*}\s+from/i); // Network type import
    });

    it('should demonstrate external API integration patterns', async () => {
      const result = await callTool(tools.mastra_mastraExamples, { example: 'bird-checker-with-nextjs' });

      // Check for API integration patterns
      expect(result).toMatch(/fetch\(/i); // Fetch calls
      expect(result).toMatch(/Authorization/i); // Headers
      expect(result).toMatch(/process\.env/i); // Environment variables
    });

    it('should include accessibility patterns in UI examples', async () => {
      const result = await callTool(tools.mastra_mastraExamples, { example: 'assistant-ui' });

      // Check for UI component patterns
      expect(result).toMatch(/@assistant-ui\/react/i); // React UI library
      expect(result).toMatch(/@assistant-ui\/react-ui/i); // UI components
      expect(result).toMatch(/tailwindcss-animate/i); // Animation utilities
    });

    it('should demonstrate state management patterns', async () => {
      const result = await callTool(tools.mastra_mastraExamples, { example: 'memory-todo-agent' });
      expect(result).toMatch(/memory/i);
    });

    it('should include testing examples', async () => {
      const result = await callTool(tools.mastra_mastraExamples, { example: 'bird-checker-with-nextjs-and-eval' });
      expect(result).toMatch(/Eval/i);
    });

    it('should demonstrate proper environment handling', async () => {
      const result = await callTool(tools.mastra_mastraExamples, { example: 'bird-checker-with-nextjs' });

      // Check for environment setup patterns
      expect(result).toMatch(/NEXT_PUBLIC_UNSPLASH_ACCESS_KEY/i); // Environment variables
      expect(result).toMatch(/process\.env/i); // Process env usage
    });

    it('should include proper error boundary examples in UI components', async () => {
      const result = await callTool(tools.mastra_mastraExamples, { example: 'bird-checker-with-nextjs' });
      expect(result).toMatch(/error/i);
    });

    it('should demonstrate proper memory management patterns', async () => {
      const result = await callTool(tools.mastra_mastraExamples, { example: 'memory-with-context' });
      expect(result).toMatch(/memory/i);
    });
  });
});
