import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { callTool, mcp } from './test-setup';

describe('examples tool integration', () => {
  let tools: any;

  beforeAll(async () => {
    tools = await mcp.getTools();
  });

  afterAll(async () => {
    await mcp.disconnect();
  });

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
});
