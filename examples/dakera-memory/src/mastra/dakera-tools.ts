/**
 * Dakera memory tools for Mastra agents.
 *
 * Dakera (https://dakera.ai) is a self-hosted, decay-weighted vector memory
 * server. These tools let a Mastra agent store and recall memories from Dakera,
 * giving agents cross-session, semantically-searchable memory without any cloud
 * dependency.
 *
 * Self-host Dakera:
 *   docker run -d -p 3300:3300 \
 *     -e DAKERA_API_KEY=demo \
 *     ghcr.io/dakera-ai/dakera:latest
 */

import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

const DAKERA_URL = process.env.DAKERA_API_URL ?? 'http://localhost:3300';
const DAKERA_KEY = process.env.DAKERA_API_KEY ?? '';
const AGENT_ID = process.env.DAKERA_AGENT_ID ?? 'mastra-agent';

function dakeraHeaders(): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (DAKERA_KEY) h['Authorization'] = `Bearer ${DAKERA_KEY}`;
  return h;
}

/**
 * Tool: recall relevant memories from Dakera using semantic search.
 *
 * The agent calls this tool when it needs context from prior conversations or
 * stored knowledge. Dakera uses decay-weighted scoring so recently-accessed,
 * high-importance memories rank higher.
 */
export const dakeraRecallTool = createTool({
  id: 'dakera-recall',
  description:
    'Recall relevant memories from long-term storage. Use this when you need context about prior ' +
    'conversations, user preferences, or domain knowledge that may have been stored in earlier sessions.',
  inputSchema: z.object({
    query: z.string().describe('Natural-language description of what you want to recall'),
    topK: z.number().int().min(1).max(20).optional().default(5).describe('Number of memories to retrieve'),
    sessionId: z.string().optional().describe('Restrict recall to a specific session'),
  }),
  outputSchema: z.object({
    memories: z.array(
      z.object({
        content: z.string(),
        score: z.number(),
        id: z.string(),
      }),
    ),
  }),
  execute: async ({ context }) => {
    const { query, topK, sessionId } = context;
    const body: Record<string, unknown> = {
      agent_id: AGENT_ID,
      query,
      top_k: topK ?? 5,
    };
    if (sessionId) body['session_id'] = sessionId;

    const resp = await fetch(`${DAKERA_URL}/v1/memory/search`, {
      method: 'POST',
      headers: dakeraHeaders(),
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      console.warn(`[dakera-recall] HTTP ${resp.status}`);
      return { memories: [] };
    }

    const data = (await resp.json()) as { memories?: Array<{ memory: { id: string; content: string }; score: number }> };
    const memories = (data.memories ?? []).map((r) => ({
      id: r.memory.id,
      content: r.memory.content,
      score: r.score,
    }));

    return { memories };
  },
});

/**
 * Tool: store a new memory in Dakera for future recall.
 *
 * The agent calls this after learning something worth remembering — user
 * preferences, decisions made, facts learned, or key context for future sessions.
 */
export const dakeraStoreTool = createTool({
  id: 'dakera-store',
  description:
    'Store a memory in long-term storage for future recall. Use this when you learn something ' +
    'important about the user, make a decision you should remember, or encounter information ' +
    'that will be useful in future conversations.',
  inputSchema: z.object({
    content: z.string().describe('The memory to store — be specific and self-contained'),
    sessionId: z.string().optional().describe('Tag this memory with a session ID'),
    tags: z
      .array(z.string())
      .optional()
      .default([])
      .describe('Optional tags for categorizing this memory (e.g. ["preference", "decision"])'),
  }),
  outputSchema: z.object({
    id: z.string(),
    stored: z.boolean(),
  }),
  execute: async ({ context }) => {
    const { content, sessionId, tags } = context;
    const body: Record<string, unknown> = {
      content,
      agent_id: AGENT_ID,
      tags: tags ?? [],
    };
    if (sessionId) body['session_id'] = sessionId;

    const resp = await fetch(`${DAKERA_URL}/v1/memory/store`, {
      method: 'POST',
      headers: dakeraHeaders(),
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      console.warn(`[dakera-store] HTTP ${resp.status}`);
      return { id: '', stored: false };
    }

    const data = (await resp.json()) as { memory: { id: string } };
    return { id: data.memory?.id ?? '', stored: true };
  },
});
