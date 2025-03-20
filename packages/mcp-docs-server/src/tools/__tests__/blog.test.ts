import { describe, expect, test, beforeAll, afterAll } from 'vitest';
import { callTool, mcp, server } from './test-setup';

describe('blog tool integration', () => {
  let tools: any;

  beforeAll(async () => {
    tools = await mcp.getTools();
  });

  afterAll(async () => {
    server.close();
    await mcp.disconnect();
  });

  test('fetches and parses blog posts', async () => {
    const result = await callTool(tools.mastra_mastraBlog, { url: '/blog' });
    expect(result).toContain('Mastra.ai Blog Posts:');
    expect(result).toContain('[Announcing our new book: Principles of Building AI agents]');
  });

  test('returns specific blog post content', async () => {
    const result = await callTool(tools.mastra_mastraBlog, { url: '/blog/principles-of-ai-engineering' });
    expect(result).toContain('Announcing our new book: Principles of Building AI agents');
    expect(result).toContain("Today is YC demo day and we're excited to announce");
  });

  test('handles invalid blog post URLs', async () => {
    const result = await callTool(tools.mastra_mastraBlog, { url: '/blog/non-existent-post' });
    expect(result).toBe('Error: Error: Failed to fetch blog posts');
  });
});
