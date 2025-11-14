import { describe, expect, test, beforeAll, afterAll } from 'vitest';
import { callTool, mcp, server } from './test-setup';

describe('blog tool', () => {
  let tools: any;
  let baseUrl: string;

  beforeAll(async () => {
    tools = await mcp.listTools();
    const port = (server.address() as { port: number }).port;
    baseUrl = `http://localhost:${port}`;
  });

  afterAll(async () => {
    server.close();
    await mcp.disconnect();
  });

  test('fetches and parses blog posts correctly', async () => {
    const result = await callTool(tools.mastra_mastraBlog, { url: '/api/blog' });
    expect(result).toContain('Mastra.ai Blog Posts:');
    expect(result).toContain(
      `[Announcing our new book: Principles of Building AI agents](${baseUrl}/blog/principles-of-ai-engineering) | [Markdown URL](${baseUrl}/api/blog/principles-of-ai-engineering)`,
    );
    expect(result).not.toContain('nav');
    expect(result).not.toContain('footer');
  });

  test('handles fetch errors gracefully', async () => {
    const result = await callTool(tools.mastra_mastraBlog, { url: `${baseUrl}/api/blog/non-existent-post` });
    expect(result).toContain('The requested blog post could not be found or fetched');
  });

  test('returns specific blog post content when URL is provided', async () => {
    const result = await callTool(tools.mastra_mastraBlog, { url: `${baseUrl}/api/blog/principles-of-ai-engineering` });
    expect(result).toContain('Principles of Building AI agents');
    expect(result).toContain("Today is YC demo day and we're excited to announce the release of our new book");
  });

  test('blog posts are formatted as markdown links', async () => {
    const result = await callTool(tools.mastra_mastraBlog, { url: '/api/blog' });
    const escapedBaseUrl = baseUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    expect(result).toMatch(
      new RegExp(
        `\\[.*\\]\\(${escapedBaseUrl}\\/blog\\/.*\\) \\| \\[Markdown URL\\]\\(${escapedBaseUrl}\\/api\\/blog\\/.*\\)`,
      ),
    );
  });

  test('handles empty blog post content', async () => {
    const result = await callTool(tools.mastra_mastraBlog, { url: `${baseUrl}/api/blog/empty-post` });
    expect(result).toContain('Failed to parse blog post');
  });
});
