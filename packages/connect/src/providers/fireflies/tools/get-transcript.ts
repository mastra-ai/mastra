// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getTranscriptInputSchema = z.object({
  id: z.string().describe('Transcript ID. Example: "abc123"'),
});

const SentenceSchema = z.object({
  index: z.number().nullish(),
  speaker_name: z.string().nullish(),
  speaker_id: z.string().nullish(),
  raw_text: z.string().nullish(),
  start_time: z.string().nullish(),
  end_time: z.string().nullish(),
  text: z.string().nullish(),
});

const SummarySectionSchema = z.object({
  title: z.string().nullish(),
  content: z.string().nullish(),
});

const SummarySchema = z.object({
  overview: z.string().nullish(),
  action_items: z.string().nullish(),
  keywords: z.string().nullish(),
  outline: z.string().nullish(),
  shorthand_bullet: z.string().nullish(),
  bullet_gist: z.string().nullish(),
  notes: z.string().nullish(),
  gist: z.string().nullish(),
  short_summary: z.string().nullish(),
  topics_discussed: z.array(z.string()).nullish(),
  transcript_chapters: z.array(z.string()).nullish(),
  extended_sections: z.array(SummarySectionSchema).nullish(),
});

const SpeakerSchema = z.object({
  id: z.string().nullish(),
  name: z.string().nullish(),
});

const MeetingInfoSchema = z.object({
  fred_joined: z.boolean().nullish(),
  silent_meeting: z.boolean().nullish(),
  summary_status: z.string().nullish(),
});

const MeetingAttendeeSchema = z.object({
  displayName: z.string().nullish(),
  email: z.string().nullish(),
  phoneNumber: z.string().nullish(),
  name: z.string().nullish(),
  location: z.string().nullish(),
});

const SentimentsSchema = z.object({
  negative_pct: z.number().nullish(),
  neutral_pct: z.number().nullish(),
  positive_pct: z.number().nullish(),
});

const AnalyticsCategoriesSchema = z.object({
  questions: z.number().nullish(),
  date_times: z.number().nullish(),
  metrics: z.number().nullish(),
  tasks: z.number().nullish(),
});

const AnalyticsSpeakerSchema = z.object({
  speaker_id: z.number().nullish(),
  name: z.string().nullish(),
  duration: z.number().nullish(),
  word_count: z.number().nullish(),
  longest_monologue: z.number().nullish(),
  monologues_count: z.number().nullish(),
  filler_words: z.number().nullish(),
  questions: z.number().nullish(),
  duration_pct: z.number().nullish(),
  words_per_minute: z.number().nullish(),
});

const AnalyticsSchema = z.object({
  sentiments: SentimentsSchema.nullable().optional(),
  categories: AnalyticsCategoriesSchema.nullable().optional(),
  speakers: z.array(AnalyticsSpeakerSchema).nullish(),
});

const TranscriptSchema = z.object({
  id: z.string().nullish(),
  title: z.string().nullish(),
  sentences: z.array(SentenceSchema).nullish(),
  summary: SummarySchema.nullable().optional(),
  speakers: z.array(SpeakerSchema).nullish(),
  meeting_info: MeetingInfoSchema.nullable().optional(),
  meeting_attendees: z.array(MeetingAttendeeSchema).nullish(),
  analytics: AnalyticsSchema.nullable().optional(),
});

const GraphQLResponseSchema = z.object({
  data: z
    .object({
      transcript: TranscriptSchema.nullable().optional(),
    })
    .optional(),
  errors: z
    .array(
      z.object({
        message: z.string().nullish(),
        code: z.string().nullish(),
        friendly: z.boolean().nullish(),
      }),
    )
    .optional(),
});

export const getTranscriptOutputSchema = z.object({
  id: z.string().optional(),
  title: z.string().optional(),
  sentences: z.array(SentenceSchema).optional(),
  summary: SummarySchema.optional(),
  speakers: z.array(SpeakerSchema).optional(),
  meeting_info: MeetingInfoSchema.optional(),
  meeting_attendees: z.array(MeetingAttendeeSchema).optional(),
  analytics: AnalyticsSchema.optional(),
});

export function getTranscriptTool(proxy: PlatformProxy) {
  return createTool({
    id: 'fireflies_get_transcript',
    description: 'Retrieve a single transcript by ID including sentences, summary, speakers, and metadata.',
    inputSchema: getTranscriptInputSchema,
    outputSchema: getTranscriptOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getTranscriptOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const query = `
            query Transcript($id: String!) {
                transcript(id: $id) {
                    id
                    title
                    sentences {
                        index
                        speaker_name
                        speaker_id
                        raw_text
                        start_time
                        end_time
                        text
                    }
                    summary {
                        overview
                        action_items
                        keywords
                        outline
                        shorthand_bullet
                        bullet_gist
                        notes
                        gist
                        short_summary
                        topics_discussed
                        transcript_chapters
                        extended_sections {
                            title
                            content
                        }
                    }
                    speakers {
                        id
                        name
                    }
                    meeting_info {
                        fred_joined
                        silent_meeting
                        summary_status
                    }
                    meeting_attendees {
                        displayName
                        email
                        phoneNumber
                        name
                        location
                    }
                    analytics {
                        sentiments {
                            negative_pct
                            neutral_pct
                            positive_pct
                        }
                        categories {
                            questions
                            date_times
                            metrics
                            tasks
                        }
                        speakers {
                            speaker_id
                            name
                            duration
                            word_count
                            longest_monologue
                            monologues_count
                            filler_words
                            questions
                            duration_pct
                            words_per_minute
                        }
                    }
                }
            }
        `;

      // https://docs.fireflies.ai/graphql-api/query/transcript
      const response = await platformProxy.post({
        endpoint: '/graphql',
        data: {
          query,
          variables: { id: input.id },
        },
        retries: 3,
      });

      const parsed = GraphQLResponseSchema.parse(response.data);

      const firstError = parsed.errors?.[0];
      if (firstError) {
        throw new platformProxy.ActionError({
          type: firstError.code ?? 'graphql_error',
          message: firstError.message ?? 'Unknown GraphQL error',
        });
      }

      const transcript = parsed.data?.transcript;

      if (!transcript) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Transcript not found',
          id: input.id,
        });
      }

      return {
        id: transcript.id ?? undefined,
        title: transcript.title ?? undefined,
        sentences: transcript.sentences ?? undefined,
        summary: transcript.summary ?? undefined,
        speakers: transcript.speakers ?? undefined,
        meeting_info: transcript.meeting_info ?? undefined,
        meeting_attendees: transcript.meeting_attendees ?? undefined,
        analytics: transcript.analytics ?? undefined,
      };
    },
  });
}
