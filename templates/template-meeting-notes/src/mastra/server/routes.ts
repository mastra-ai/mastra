import { registerApiRoute } from '@mastra/core/server';
import { meetingNotesOutputSchema } from '../agents/meeting-notes';

/**
 * POST /meetings/upload
 *
 * Manual ingestion path for sources that aren't Zoom (e.g. a transcript copied
 * from Google Meet, Riverside, Loom, or a raw text file).
 *
 * Body: { title?: string; transcript: string }
 * Returns: structured meeting notes JSON.
 */
export const meetingsUploadRoute = registerApiRoute('/meetings/upload', {
  method: 'POST',
  handler: async c => {
    let body: { title?: string; transcript?: string };
    try {
      body = (await c.req.json()) as { title?: string; transcript?: string };
    } catch {
      return c.json({ error: 'Invalid JSON body.' }, 400);
    }
    if (!body.transcript || typeof body.transcript !== 'string') {
      return c.json({ error: 'Missing `transcript` (string) in body.' }, 400);
    }

    const mastra = c.get('mastra');
    const agent = mastra.getAgent('meetingNotesAgent');
    const userMessage = body.title
      ? `Summarize this transcript from "${body.title}":\n\n${body.transcript}`
      : `Summarize this meeting transcript:\n\n${body.transcript}`;

    const result = await agent.generate([{ role: 'user', content: userMessage }], {
      structuredOutput: { schema: meetingNotesOutputSchema },
    });

    return c.json(result.object);
  },
});
