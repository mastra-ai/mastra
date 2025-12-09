/**
 * Demo: Direct Server App Access
 *
 * This demonstrates how to use mastra.getServerApp() to call routes
 * directly without running an HTTP server.
 *
 * Use case: CLI scripts, batch processing, testing, background jobs
 *
 * NOTE: The base URL (http://internal) is just a placeholder - Hono's app.fetch()
 * processes requests in-memory and only uses the path. The hostname is ignored.
 */

import { HonoBindings, HonoVariables, MastraServer } from '@mastra/hono';
import { Hono } from 'hono';
import type { Hono as HonoType } from 'hono';

import { mastra } from './mastra';

// Base URL is a placeholder - only the path matters for in-memory routing
const BASE_URL = 'http://internal';

async function main() {
  // Create and initialize server (no port binding)
  const app = new Hono<{ Bindings: HonoBindings; Variables: HonoVariables }>();
  const adapter = new MastraServer({ app, mastra });
  await adapter.init();

  // Get the server app - works because MastraServer auto-registers with mastra
  const serverApp = mastra.getServerApp<HonoType>();
  if (!serverApp) throw new Error('Server app not initialized');

  // List tools
  console.log('--- List Tools ---');
  const toolsResponse = await serverApp.fetch(new Request(`${BASE_URL}/api/tools`));
  const tools = (await toolsResponse.json()) as Record<string, unknown>;
  console.log(`Tools: ${Object.keys(tools).join(', ') || '(none registered by key)'}`);

  // Execute a tool
  console.log('\n--- Execute Tool ---');
  const calcResponse = await serverApp.fetch(
    new Request(`${BASE_URL}/api/tools/calculator/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: { operation: 'multiply', a: 7, b: 6 } }),
    }),
  );
  console.log(`Result: ${JSON.stringify(await calcResponse.json())}`);

  // List workflows
  console.log('\n--- List Workflows ---');
  const workflowsResponse = await serverApp.fetch(new Request(`${BASE_URL}/api/workflows`));
  const workflows = (await workflowsResponse.json()) as Record<string, unknown>;
  console.log(`Workflows: ${Object.keys(workflows).join(', ')}`);
}

main().catch(console.error);
