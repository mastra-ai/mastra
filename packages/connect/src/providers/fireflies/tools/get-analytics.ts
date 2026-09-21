// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getAnalyticsInputSchema = z.object({
  start_time: z.string().describe('Start date in ISO 8601 format. Example: "2024-01-01T00:00:00Z"'),
  end_time: z.string().describe('End date in ISO 8601 format. Example: "2024-01-31T23:59:59Z"'),
});

const AverageSentimentSchema = z.object({
  negative_pct: z.number().nullable().optional(),
  neutral_pct: z.number().nullable().optional(),
  positive_pct: z.number().nullable().optional(),
});

const TeamConversationSchema = z.object({
  average_filler_words: z.number().nullable().optional(),
  average_filler_words_diff_pct: z.number().nullable().optional(),
  average_monologues_count: z.number().nullable().optional(),
  average_monologues_count_diff_pct: z.number().nullable().optional(),
  average_questions: z.number().nullable().optional(),
  average_questions_diff_pct: z.number().nullable().optional(),
  average_sentiments: AverageSentimentSchema.nullable().optional(),
  average_silence_duration: z.number().nullable().optional(),
  average_silence_duration_diff_pct: z.number().nullable().optional(),
  average_talk_listen_ratio: z.number().nullable().optional(),
  average_words_per_minute: z.number().nullable().optional(),
  longest_monologue_duration_sec: z.number().nullable().optional(),
  longest_monologue_duration_diff_pct: z.number().nullable().optional(),
  total_filler_words: z.number().nullable().optional(),
  total_filler_words_diff_pct: z.number().nullable().optional(),
  total_meeting_notes_count: z.number().nullable().optional(),
  total_meetings_count: z.number().nullable().optional(),
  total_monologues_count: z.number().nullable().optional(),
  total_monologues_diff_pct: z.number().nullable().optional(),
  teammates_count: z.number().nullable().optional(),
  total_questions: z.number().nullable().optional(),
  total_questions_diff_pct: z.number().nullable().optional(),
  total_silence_duration: z.number().nullable().optional(),
  total_silence_duration_diff_pct: z.number().nullable().optional(),
});

const TeamMeetingSchema = z.object({
  count: z.number().nullable().optional(),
  count_diff_pct: z.number().nullable().optional(),
  duration: z.number().nullable().optional(),
  duration_diff_pct: z.number().nullable().optional(),
  average_count: z.number().nullable().optional(),
  average_count_diff_pct: z.number().nullable().optional(),
  average_duration: z.number().nullable().optional(),
  average_duration_diff_pct: z.number().nullable().optional(),
});

const TeamSchema = z.object({
  conversation: TeamConversationSchema.optional(),
  meeting: TeamMeetingSchema.optional(),
});

const UserConversationSchema = z.object({
  talk_listen_pct: z.number().nullable().optional(),
  talk_listen_ratio: z.number().nullable().optional(),
  total_silence_duration: z.number().nullable().optional(),
  total_silence_duration_compare_to: z.number().nullable().optional(),
  total_silence_pct: z.number().nullable().optional(),
  total_silence_ratio: z.number().nullable().optional(),
  total_speak_duration: z.number().nullable().optional(),
  total_speak_duration_with_user: z.number().nullable().optional(),
  total_word_count: z.number().nullable().optional(),
  user_filler_words: z.number().nullable().optional(),
  user_filler_words_compare_to: z.number().nullable().optional(),
  user_filler_words_diff_pct: z.number().nullable().optional(),
  user_longest_monologue_sec: z.number().nullable().optional(),
  user_longest_monologue_compare_to: z.number().nullable().optional(),
  user_longest_monologue_diff_pct: z.number().nullable().optional(),
  user_monologues_count: z.number().nullable().optional(),
  user_monologues_count_compare_to: z.number().nullable().optional(),
  user_monologues_count_diff_pct: z.number().nullable().optional(),
  user_questions: z.number().nullable().optional(),
  user_questions_compare_to: z.number().nullable().optional(),
  user_questions_diff_pct: z.number().nullable().optional(),
  user_speak_duration: z.number().nullable().optional(),
  user_word_count: z.number().nullable().optional(),
  user_words_per_minute: z.number().nullable().optional(),
  user_words_per_minute_compare_to: z.number().nullable().optional(),
  user_words_per_minute_diff_pct: z.number().nullable().optional(),
});

const UserMeetingSchema = z.object({
  count: z.number().nullable().optional(),
  count_diff: z.number().nullable().optional(),
  count_diff_compared_to: z.number().nullable().optional(),
  count_diff_pct: z.number().nullable().optional(),
  duration: z.number().nullable().optional(),
  duration_diff: z.number().nullable().optional(),
  duration_diff_compared_to: z.number().nullable().optional(),
  duration_diff_pct: z.number().nullable().optional(),
});

const UserSchema = z.object({
  user_id: z.string().optional(),
  user_name: z.string().optional(),
  user_email: z.string().optional(),
  conversation: UserConversationSchema.optional(),
  meeting: UserMeetingSchema.optional(),
});

const AnalyticsSchema = z.object({
  team: TeamSchema.nullable().optional(),
  users: z.array(UserSchema).optional(),
});

export const getAnalyticsOutputSchema = z.object({
  team: TeamSchema.optional(),
  users: z.array(UserSchema).optional(),
});

const ProviderResponseSchema = z.object({
  data: z
    .object({
      analytics: AnalyticsSchema.nullable().optional(),
    })
    .nullable()
    .optional(),
  errors: z
    .array(
      z.object({
        message: z.string(),
        code: z.string().optional(),
      }),
    )
    .optional(),
});

export function getAnalyticsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'fireflies_get_analytics',
    description: 'Get conversation analytics for a date range.',
    inputSchema: getAnalyticsInputSchema,
    outputSchema: getAnalyticsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getAnalyticsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.post({
        // https://docs.fireflies.ai/graphql-api/query/analytics
        endpoint: '/graphql',
        data: {
          query: `
                    query Analytics($startTime: String, $endTime: String) {
                        analytics(start_time: $startTime, end_time: $endTime) {
                            team {
                                conversation {
                                    average_filler_words
                                    average_filler_words_diff_pct
                                    average_monologues_count
                                    average_monologues_count_diff_pct
                                    average_questions
                                    average_questions_diff_pct
                                    average_sentiments {
                                        negative_pct
                                        neutral_pct
                                        positive_pct
                                    }
                                    average_silence_duration
                                    average_silence_duration_diff_pct
                                    average_talk_listen_ratio
                                    average_words_per_minute
                                    longest_monologue_duration_sec
                                    longest_monologue_duration_diff_pct
                                    total_filler_words
                                    total_filler_words_diff_pct
                                    total_meeting_notes_count
                                    total_meetings_count
                                    total_monologues_count
                                    total_monologues_diff_pct
                                    teammates_count
                                    total_questions
                                    total_questions_diff_pct
                                    total_silence_duration
                                    total_silence_duration_diff_pct
                                }
                                meeting {
                                    count
                                    count_diff_pct
                                    duration
                                    duration_diff_pct
                                    average_count
                                    average_count_diff_pct
                                    average_duration
                                    average_duration_diff_pct
                                }
                            }
                            users {
                                user_id
                                user_name
                                user_email
                                conversation {
                                    talk_listen_pct
                                    talk_listen_ratio
                                    total_silence_duration
                                    total_silence_duration_compare_to
                                    total_silence_pct
                                    total_silence_ratio
                                    total_speak_duration
                                    total_speak_duration_with_user
                                    total_word_count
                                    user_filler_words
                                    user_filler_words_compare_to
                                    user_filler_words_diff_pct
                                    user_longest_monologue_sec
                                    user_longest_monologue_compare_to
                                    user_longest_monologue_diff_pct
                                    user_monologues_count
                                    user_monologues_count_compare_to
                                    user_monologues_count_diff_pct
                                    user_questions
                                    user_questions_compare_to
                                    user_questions_diff_pct
                                    user_speak_duration
                                    user_word_count
                                    user_words_per_minute
                                    user_words_per_minute_compare_to
                                    user_words_per_minute_diff_pct
                                }
                                meeting {
                                    count
                                    count_diff
                                    count_diff_compared_to
                                    count_diff_pct
                                    duration
                                    duration_diff
                                    duration_diff_compared_to
                                    duration_diff_pct
                                }
                            }
                        }
                    }
                `,
          variables: {
            startTime: input.start_time,
            endTime: input.end_time,
          },
        },
        retries: 3,
      });

      const parsed = ProviderResponseSchema.parse(response.data);

      if (parsed.errors && parsed.errors.length > 0) {
        const firstError = parsed.errors[0];
        throw new platformProxy.ActionError({
          type: 'provider_error',
          message: firstError?.message,
          code: firstError?.code,
        });
      }

      const analytics = parsed.data?.analytics;

      if (!analytics) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Analytics not found for the given date range.',
        });
      }

      return {
        ...(analytics.team != null && { team: analytics.team }),
        ...(analytics.users != null && { users: analytics.users }),
      };
    },
  });
}
