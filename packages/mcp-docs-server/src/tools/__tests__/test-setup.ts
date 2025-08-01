import fs from 'fs';
import path from 'path';
import { serve } from '@hono/node-server';
import { MCPClient } from '@mastra/mcp';
import { Hono } from 'hono';
import type { Context } from 'hono';

// Load fixtures
const blogListFixture = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../__fixtures__/blog-list-raw.json'), 'utf-8'),
);
const blogPostFixture = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../__fixtures__/blog-post-raw.json'), 'utf-8'),
);
const emptyPostFixture = JSON.parse(fs.readFileSync(path.join(__dirname, '../__fixtures__/empty-post.json'), 'utf-8'));

// Set up test Hono server
const app = new Hono();

// Mock blog list endpoint using fixture
app.get('/api/blog', (c: Context) => {
  return c.json(blogListFixture);
});

// Mock specific blog post endpoint using fixture
app.get('/api/blog/principles-of-ai-engineering', (c: Context) => {
  return c.json(blogPostFixture);
});

app.get('/blog/rate-limited', (_c: Context) => {
  console.log('Rate limit exceeded');
  return new Response('Rate limit exceeded', {
    status: 429,
    statusText: 'Too Many Requests',
  });
});

app.get('/api/blog/empty-post', (c: Context) => {
  return c.json(emptyPostFixture);
});

// Start the server
export const server = serve({
  fetch: app.fetch,
  port: 0,
});

// Get the actual port the server is running on
const port = (server.address() as { port: number }).port;

export const mcp = new MCPClient({
  id: 'test-mcp',
  servers: {
    mastra: {
      command: 'node',
      args: [path.join(__dirname, '../../../dist/stdio.js')],
      env: {
        BLOG_URL: `http://localhost:${port}`,
      },
    },
  },
});

export async function callTool(tool: any, args: any) {
  const response = await tool.execute({ context: args });

  // Handle string responses
  if (typeof response === 'string') {
    return response;
  }

  // Handle validation error responses
  if (response?.error === true && response?.message) {
    return response.message;
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
