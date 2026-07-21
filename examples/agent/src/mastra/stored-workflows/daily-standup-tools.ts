import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

/**
 * Deterministic first step of the `daily-standup-digest` stored workflow.
 * Builds one `{ prompt }` per author from the raw standup notes so the next
 * step (`foreach(normalizerAgent)`) can iterate over an array of agent-ready
 * inputs. Foreach reads the previous step's output directly and agent steps
 * expect `{ prompt: string }`, so this tool bridges the two.
 */
export const buildNormalizerPromptsTool = createTool({
  id: 'build-normalizer-prompts',
  description: 'Turns raw standup notes into per-author prompts for the normalizer agent.',
  inputSchema: z.object({
    teamName: z.string(),
    notes: z.array(
      z.object({
        author: z.string(),
        text: z.string(),
      }),
    ),
  }),
  outputSchema: z.array(
    z.object({
      prompt: z.string(),
    }),
  ),
  execute: async ({ notes }) => {
    return notes.map(note => ({
      prompt: `Author: ${note.author}\nRaw note: ${note.text}`,
    }));
  },
});

/**
 * Deterministic final step of the `daily-standup-digest` stored workflow.
 * Wraps the digest markdown produced by the `standup-digest` agent in a
 * dated header so the workflow's terminal output is one self-contained
 * markdown document.
 *
 * Kept as a tool (not an agent) so the last step of the demo is guaranteed
 * to run without an LLM call — useful for eyeballing the workflow shape in
 * Studio without waiting on model latency.
 */
export const formatDigestTool = createTool({
  id: 'format-standup-digest',
  description: 'Wraps a standup digest in a dated markdown header for a given team.',
  inputSchema: z.object({
    teamName: z.string(),
    digest: z.string(),
  }),
  outputSchema: z.object({
    markdown: z.string(),
  }),
  execute: async ({ teamName, digest }) => {
    const today = new Date().toISOString().slice(0, 10);
    const markdown = `# ${teamName} — Daily Standup (${today})\n\n${digest.trim()}\n`;
    return { markdown };
  },
});
