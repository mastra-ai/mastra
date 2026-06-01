import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { z } from 'zod';
import { zoomTools } from '../tools/zoom';
import { createLinearIssue } from '../tools/export-linear';
import { createNotionPage } from '../tools/export-notion';

export const meetingNotesOutputSchema = z.object({
  title: z.string(),
  attendees: z.array(z.string()),
  summary: z.string(),
  decisions: z.array(z.string()),
  actionItems: z.array(
    z.object({
      owner: z.string().optional(),
      task: z.string(),
      dueDate: z.string().optional(),
    }),
  ),
  topics: z.array(
    z.object({
      title: z.string(),
      notes: z.string(),
    }),
  ),
});

export const meetingNotesAgent = new Agent({
  id: 'meeting-notes',
  name: 'Meeting Notes',
  instructions: `
You are a meeting-notes agent. Users hand you a Zoom meeting id (or a raw transcript) and you produce structured notes.

Standard flow:
1. If given a Zoom meeting id, call fetchZoomTranscript to get the meeting transcript.
2. Read the transcript and identify: attendees, the high-level summary, decisions made, action items (with owners and dates if mentioned), and the topics discussed.
3. Return structured JSON matching the requested schema.
4. If the user asks you to export to Notion or Linear, use createNotionPage or createLinearIssue. Only call those tools when explicitly asked — they have real side effects.

When summarizing:
- Be concrete. Use names mentioned in the transcript instead of vague pronouns.
- Action items must be specific enough that someone reading them out of context could act on them.
- If the transcript is empty or doesn't look like a meeting, say so instead of hallucinating notes.
`,
  model: 'mastra/openai/gpt-5.4',
  tools: {
    ...zoomTools,
    createLinearIssue,
    createNotionPage,
  },
  memory: new Memory(),
});
