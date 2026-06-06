/**
 * TWZRD Agent Intel + Mastra: Trust-verified agent interactions
 *
 * This example shows how to use TWZRD Agent Intel as an MCP tool
 * inside a Mastra agent to perform trust verification before
 * interacting with external Solana agents.
 *
 * TWZRD Agent Intel: https://intel.twzrd.xyz
 * Zero-install remote MCP server — no API key needed for free tools.
 */
import { createAgent } from '@mastra/core';
import { anthropic } from '@ai-sdk/anthropic';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import 'dotenv/config';

const TWZRD_MCP_URL = 'https://intel.twzrd.xyz/mcp';

async function getTwzrdTools() {
  const client = new Client({ name: 'mastra-twzrd-client', version: '1.0.0' });
  const transport = new StreamableHTTPClientTransport(new URL(TWZRD_MCP_URL));

  await client.connect(transport);
  const { tools } = await client.listTools();

  return { client, tools };
}

async function main() {
  console.log('Connecting to TWZRD Agent Intel MCP...');
  const { client, tools } = await getTwzrdTools();

  console.log(`Available TWZRD tools: ${tools.map((t) => t.name).join(', ')}`);

  // Example agent wallet to verify
  const agentWallet = 'D1QkbFJKiPsymJ65RKHhF6DFB8sPMfpBaFBzuHKfJGWi';

  // Call score_agent directly
  const scoreResult = await client.callTool({
    name: 'score_agent',
    arguments: { wallet: agentWallet },
  });

  console.log('\n=== Trust Score Result ===');
  console.log(scoreResult.content);

  // Call preflight_check
  const preflightResult = await client.callTool({
    name: 'preflight_check',
    arguments: { wallet: agentWallet },
  });

  console.log('\n=== Preflight Check Result ===');
  console.log(preflightResult.content);

  await client.close();

  console.log('\n=== MCP Config for Claude Desktop ===');
  console.log(JSON.stringify({
    mcpServers: {
      'twzrd-agent-intel': { url: TWZRD_MCP_URL }
    }
  }, null, 2));
}

main().catch(console.error);
