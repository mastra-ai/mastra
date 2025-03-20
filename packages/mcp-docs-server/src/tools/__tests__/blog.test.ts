import fs from 'fs';
import path from 'path';
import { MCPConfiguration } from '@mastra/mcp';
import { describe, expect, test, beforeAll, afterAll } from 'vitest';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import type { Context } from 'hono';

describe('blog tool integration', () => {
  let mcp: MCPConfiguration;
  let tools: any;
  let server: any;
  let port: number;
  let blogListFixture: string;
  let blogPostFixture: string;

  async function callTool(tool: any, args: any) {
    const response = await tool.execute({ context: args });

    // Handle string responses
    if (typeof response === 'string') {
      return response;
    }

    // Handle content array responses
    if (response?.content) {
      let text = ``;
      for (const part of response.content) {
        if (part?.type === `text`) {
          text += part?.text;
        } else {
          throw new Error(`Found tool content part that's not accounted for. ${JSON.stringify(part, null, 2)}`);
        }
      }
      return text;
    }

    throw new Error('Unexpected response format');
  }

  beforeAll(async () => {
    // Load fixtures
    blogListFixture = fs.readFileSync(path.join(__dirname, '../__fixtures__/blog-list-raw.txt'), 'utf-8');
    blogPostFixture = fs.readFileSync(path.join(__dirname, '../__fixtures__/blog-post-raw.txt'), 'utf-8');

    // Set up test Hono server
    const app = new Hono();

    // Mock blog list endpoint using fixture
    app.get('/blog', (c: Context) => {
      return c.html(blogListFixture);
    });

    // Mock specific blog post endpoint using fixture
    app.get('/blog/principles-of-ai-engineering', (c: Context) => {
      return c.html(blogPostFixture);
    });

    // Start the server on any available port
    server = serve({
      fetch: app.fetch,
      port: 0,
    });

    // Get the actual port the server is running on
    port = (server.address() as { port: number }).port;

    // Set up MCP with test server URL
    mcp = new MCPConfiguration({
      id: 'test-mcp-blog',
      servers: {
        mastra: {
          command: 'node',
          args: [path.join(__dirname, '../../../dist/stdio.js')],
          env: { BLOG_URL: `http://localhost:${port}` },
        },
      },
    });
    tools = await mcp.getTools();
  });

  afterAll(async () => {
    await mcp.disconnect();
    await server.close();
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
