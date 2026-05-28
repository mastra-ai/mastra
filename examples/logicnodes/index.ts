/**
 * LogicNodes MCP Integration for Mastra
 * =======================================
 * Demonstrates how to integrate LogicNodes deterministic compute workers
 * into a Mastra workflow via the Model Context Protocol (MCP) or direct REST.
 *
 * LogicNodes provides 2,300+ cryptographically-signed microservices:
 * gas oracles, compliance sentries, identity verification, ZK attestation,
 * DeFi quotes, bridge data, and more — all callable via MCP or REST.
 *
 * Install:
 *   npm install @mastra/core @mastra/mcp zod
 *
 * Usage:
 *   export OPENAI_API_KEY=sk-...
 *   export LOGICNODES_API_KEY=your_key_from_https://logicnodes.io/checkout
 *   npx tsx examples/logicnodes/index.ts
 */

import { Mastra, createTool } from "@mastra/core";
import { MCPClient } from "@mastra/mcp";
import { Agent } from "@mastra/core/agent";
import { openai } from "@mastra/core/llm/openai";
import { z } from "zod";

const LOGICNODES_MCP_URL = "https://logicnodes.io/mcp";
const LOGICNODES_BASE = "https://logicnodes.io";
const LOGICNODES_API_KEY = process.env.LOGICNODES_API_KEY ?? "";

/** Build auth headers for direct REST calls */
function lnHeaders(): Record<string, string> {
  return LOGICNODES_API_KEY
    ? { Authorization: `Bearer ${LOGICNODES_API_KEY}` }
    : {};
}

// ---------------------------------------------------------------------------
// Option A: Statically defined Mastra tools (direct REST)
// ---------------------------------------------------------------------------

const gasOracleTool = createTool({
  id: "logicnodes-gas-oracle",
  description:
    "Query the LogicNodes gas oracle for deterministic EIP-1559 gas estimates. " +
    "Returns a cryptographically-signed payload with base fee, priority fee, and max fee.",
  inputSchema: z.object({
    chain: z
      .string()
      .optional()
      .default("ethereum")
      .describe("Chain name: ethereum, base, polygon, arbitrum"),
  }),
  outputSchema: z.record(z.unknown()),
  execute: async ({ context }) => {
    const res = await fetch(`${LOGICNODES_BASE}/call/gas-oracle`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...lnHeaders() },
      body: JSON.stringify({ chain: context.chain }),
    });
    return res.json();
  },
});

const complianceSentryTool = createTool({
  id: "logicnodes-compliance-sentry",
  description:
    "Run an on-chain compliance check for an autonomous agent action via LogicNodes. " +
    "Returns a verifiable attestation of whether the action is permitted.",
  inputSchema: z.object({
    agentId: z
      .string()
      .describe("Agent wallet address or DID to check compliance for."),
    action: z.string().describe("Description of the action to verify."),
    context: z
      .string()
      .optional()
      .default("")
      .describe("Optional JSON context for richer analysis."),
  }),
  outputSchema: z.record(z.unknown()),
  execute: async ({ context }) => {
    const res = await fetch(`${LOGICNODES_BASE}/call/compliance-sentry`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...lnHeaders() },
      body: JSON.stringify({
        agent_id: context.agentId,
        action: context.action,
        context: context.context,
      }),
    });
    return res.json();
  },
});

const ethPriceTool = createTool({
  id: "logicnodes-eth-price",
  description:
    "Fetch the current ETH/USD price from LogicNodes. Output is cryptographically " +
    "signed and suitable for on-chain price verification.",
  inputSchema: z.object({}),
  outputSchema: z.record(z.unknown()),
  execute: async () => {
    const res = await fetch(`${LOGICNODES_BASE}/call/eth-price`, {
      headers: lnHeaders(),
    });
    return res.json();
  },
});

const zkAttestTool = createTool({
  id: "logicnodes-zk-attest",
  description:
    "Anchor content on-chain via LogicNodes ZK attestation. Returns a verifiable " +
    "proof-of-existence anchored to Base L2. Useful for audit trails.",
  inputSchema: z.object({
    content: z.string().describe("Text or JSON content to anchor on-chain."),
  }),
  outputSchema: z.record(z.unknown()),
  execute: async ({ context }) => {
    const res = await fetch(`${LOGICNODES_BASE}/x402/zk-attest`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...lnHeaders() },
      body: JSON.stringify({ content: context.content }),
    });
    return res.json();
  },
});

const graphScoreTool = createTool({
  id: "logicnodes-graph-score",
  description:
    "Retrieve the LogicNodes trust graph score for an agent based on on-chain history.",
  inputSchema: z.object({
    agentId: z.string().describe("Agent wallet address or DID."),
  }),
  outputSchema: z.record(z.unknown()),
  execute: async ({ context }) => {
    const res = await fetch(
      `${LOGICNODES_BASE}/graph/score/${context.agentId}`,
      { headers: lnHeaders() }
    );
    return res.json();
  },
});

// ---------------------------------------------------------------------------
// Option B: Dynamic MCP tool discovery (connects to LogicNodes MCP server)
// ---------------------------------------------------------------------------

async function createMcpClient(): Promise<MCPClient> {
  return new MCPClient({
    servers: {
      logicnodes: {
        url: new URL(LOGICNODES_MCP_URL),
      },
    },
  });
}

// ---------------------------------------------------------------------------
// Build Mastra agent and workflow
// ---------------------------------------------------------------------------

const logicnodesAgent = new Agent({
  name: "LogicNodesAgent",
  instructions:
    "You are an autonomous on-chain agent powered by LogicNodes deterministic " +
    "compute. Before recommending any on-chain action:\n" +
    "1. Always call logicnodes-compliance-sentry to verify compliance.\n" +
    "2. Use logicnodes-gas-oracle to provide accurate transaction cost estimates.\n" +
    "3. Use logicnodes-eth-price for current ETH valuation.\n" +
    "4. Anchor critical decisions with logicnodes-zk-attest for audit trails.\n" +
    "5. Check logicnodes-graph-score to assess counterparty reputation.\n\n" +
    "All LogicNodes responses are cryptographically signed and verifiable on Base L2.",
  model: openai("gpt-4o"),
  tools: {
    gasOracleTool,
    complianceSentryTool,
    ethPriceTool,
    zkAttestTool,
    graphScoreTool,
  },
});

// Mastra instance — add more agents and integrations as needed
const mastra = new Mastra({
  agents: { logicnodesAgent },
});

// ---------------------------------------------------------------------------
// Main demo
// ---------------------------------------------------------------------------

async function main() {
  console.log("=== LogicNodes + Mastra Integration Demo ===\n");

  // Demo 1: Static tools via direct REST
  console.log("--- Demo 1: Direct REST tools ---");
  const agent = mastra.getAgent("logicnodesAgent");
  const response = await agent.generate(
    "Check ETH price and gas estimate for Ethereum. " +
      "Then verify compliance for agent 'mastra-demo' performing 'swap 100 USDC to ETH'. " +
      "Should I proceed?"
  );
  console.log("Agent response:\n", response.text);

  // Demo 2: Dynamic MCP tool discovery
  console.log("\n--- Demo 2: MCP tool discovery ---");
  try {
    const mcpClient = await createMcpClient();
    const mcpTools = await mcpClient.getTools();
    console.log(
      `LogicNodes MCP tools discovered: ${Object.keys(mcpTools).length}`
    );
    console.log("Sample tools:", Object.keys(mcpTools).slice(0, 5).join(", "));
    await mcpClient.disconnect();
  } catch (err) {
    console.log("MCP demo skipped (MCP server not reachable):", String(err));
  }
}

main().catch(console.error);
