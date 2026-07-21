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
 * Inspects the normalized standup notes (as JSON-encoded text from the
 * `foreach(agent)` step) and reports whether any of them mention a real
 * blocker. Used by the main workflow's conditional to route to either the
 * plain-digest or with-escalation sub-workflow.
 */
export const detectBlockersTool = createTool({
  id: 'detect-blockers',
  description: 'Reports whether any normalized standup note contains a real blocker.',
  inputSchema: z.object({
    normalizedNotesJson: z.string(),
  }),
  outputSchema: z.object({
    hasBlockers: z.boolean(),
    blockerCount: z.number(),
  }),
  execute: async ({ normalizedNotesJson }) => {
    // The normalizer agent emits lines like "Blocked: None" or "Blocked: <phrase>".
    // A blocker is anything that is not literally "None" (case-insensitive).
    const matches = [...normalizedNotesJson.matchAll(/Blocked:\s*([^\n"\\]+)/gi)];
    const blockerCount = matches.filter(m => {
      const val = (m[1] ?? '').trim().toLowerCase();
      return val.length > 0 && val !== 'none' && val !== '"none"';
    }).length;
    return { hasBlockers: blockerCount > 0, blockerCount };
  },
});

/**
 * Deterministic final step of the `daily-standup-plain` sub-workflow.
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

/**
 * Terminal step of the `daily-standup-with-escalation` sub-workflow. Stitches
 * the team digest and the tech-lead escalation message into a single dated
 * markdown document with a dedicated "Escalation" section.
 */
export const formatDigestWithEscalationTool = createTool({
  id: 'format-standup-digest-with-escalation',
  description: 'Combines the standup digest and an escalation message into one dated markdown document.',
  inputSchema: z.object({
    teamName: z.string(),
    digest: z.string(),
    escalation: z.string(),
  }),
  outputSchema: z.object({
    markdown: z.string(),
  }),
  execute: async ({ teamName, digest, escalation }) => {
    const today = new Date().toISOString().slice(0, 10);
    const markdown =
      `# ${teamName} — Daily Standup (${today})\n\n` +
      `${digest.trim()}\n\n` +
      `## Escalation\n${escalation.trim()}\n`;
    return { markdown };
  },
});
