import { describe, expect, test, beforeAll, afterAll } from 'vitest';
import { callTool, mcp, server } from './test-setup';

describe('blog tool', () => {
  let tools: any;

  beforeAll(async () => {
    tools = await mcp.getTools();
  });

  afterAll(async () => {
    server.close();
    await mcp.disconnect();
  });

  test('fetches and parses blog posts correctly', async () => {
    const result = await callTool(tools.mastra_mastraBlog, { url: '/blog' });
    expect(result).toContain('Mastra.ai Blog Posts:');
    expect(result).toContain(
      '[Announcing our new book: Principles of Building AI agents](/blog/principles-of-ai-engineering)',
    );
    expect(result).toContain('[AI Beats Laboratory: A Multi-Agent Music Generation System](/blog/ai-beats-lab)');
    expect(result).not.toContain('nav');
    expect(result).not.toContain('footer');
  });

  test('handles fetch errors gracefully', async () => {
    const result = await callTool(tools.mastra_mastraBlog, { url: '/blog/non-existent-post' });
    expect(result).toBe('Error: Failed to fetch blog post');
  });

  test('returns specific blog post content when URL is provided', async () => {
    const result = await callTool(tools.mastra_mastraBlog, { url: '/blog/principles-of-ai-engineering' });
    expect(result).toContain('Principles of Building AI agents');
    expect(result).toContain("Today is YC demo day and we're excited to announce the release of our new book");
  });

  test('removes Next.js initialization code from blog post content', async () => {
    const result = await callTool(tools.mastra_mastraBlog, { url: '/blog/principles-of-ai-engineering' });
    expect(result).not.toContain('self.__next_f');
  });
});
