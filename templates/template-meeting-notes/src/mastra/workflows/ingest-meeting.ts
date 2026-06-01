import { createWorkflow, createStep } from '@mastra/core/workflows';
import { z } from 'zod';
import { meetingNotesOutputSchema } from '../agents/meeting-notes';

const fetchTranscriptStep = createStep({
  id: 'fetch-zoom-transcript',
  description: 'Download the Zoom-generated transcript for a meeting.',
  inputSchema: z.object({
    meetingId: z.string(),
  }),
  outputSchema: z.object({
    meetingId: z.string(),
    transcript: z.string(),
  }),
  execute: async ({ inputData }) => {
    const { fetchZoomTranscript } = await import('../tools/zoom');
    const result = await fetchZoomTranscript.execute!({ meetingId: inputData.meetingId }, {} as any);
    return { meetingId: inputData.meetingId, transcript: (result as { transcript: string }).transcript };
  },
});

const summarizeStep = createStep({
  id: 'summarize-transcript',
  description: 'Summarize the transcript into structured meeting notes.',
  inputSchema: z.object({
    meetingId: z.string(),
    transcript: z.string(),
  }),
  outputSchema: meetingNotesOutputSchema,
  execute: async ({ inputData, mastra }) => {
    const agent = mastra.getAgent('meetingNotesAgent');
    const result = await agent.generate(
      [
        {
          role: 'user',
          content: `Summarize this meeting transcript into structured notes:\n\n${inputData.transcript}`,
        },
      ],
      { structuredOutput: { schema: meetingNotesOutputSchema } },
    );
    return result.object as z.infer<typeof meetingNotesOutputSchema>;
  },
});

export const ingestMeetingWorkflow = createWorkflow({
  id: 'ingest-meeting',
  description: 'Pull a Zoom recording, transcribe (via Zoom AI Companion), and summarize into structured notes.',
  inputSchema: z.object({
    meetingId: z.string(),
  }),
  outputSchema: meetingNotesOutputSchema,
})
  .then(fetchTranscriptStep)
  .then(summarizeStep)
  .commit();
