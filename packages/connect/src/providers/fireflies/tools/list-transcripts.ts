// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listTranscriptsInputSchema = z
  .object({
    fromDate: z
      .string()
      .optional()
      .describe('Return all transcripts created after this date. ISO 8601 format. Example: "2024-07-08T22:13:46.660Z"'),
    toDate: z
      .string()
      .optional()
      .describe(
        'Return all transcripts created before this date. ISO 8601 format. Example: "2024-07-08T22:13:46.660Z"',
      ),
    limit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .optional()
      .describe('Number of transcripts to return. Maximum 50 in one query.'),
    skip: z.number().int().min(0).optional().describe('Number of transcripts to skip.'),
    title: z
      .string()
      .max(256)
      .optional()
      .describe('Deprecated. Use keyword instead. Title of the transcript. Mutually exclusive with keyword.'),
    keyword: z
      .string()
      .max(255)
      .optional()
      .describe(
        'Allows searching for keywords in meeting title and/or words spoken during the meeting. Mutually exclusive with title.',
      ),
    scope: z
      .enum(['title', 'sentences', 'all'])
      .optional()
      .describe(
        'Specify the scope for keyword search. If scope is provided, keyword becomes a required field. Defaults to TITLE if no value is provided.',
      ),
    user_id: z
      .string()
      .optional()
      .describe('User id. Filter all meetings that have this user ID as the organizer or participant.'),
    mine: z.boolean().optional().describe('Filter all meetings that have the API key owner as the organizer.'),
    organizers: z
      .array(z.string().max(256))
      .optional()
      .describe('Filter meetings that have any of these emails as organizers. Accepts an array of email addresses.'),
    participants: z
      .array(z.string().max(256))
      .optional()
      .describe('Filter meetings that contain any of these emails as attendees. Accepts an array of email addresses.'),
    channel_id: z
      .string()
      .max(256)
      .optional()
      .describe('Filter meetings that belong to a specific channel. Accepts a single channel ID.'),
    host_email: z
      .string()
      .optional()
      .describe('Filter all meetings accordingly to meetings that have this email as the host.'),
    organizer_email: z
      .string()
      .optional()
      .describe('Deprecated. Use organizers instead. Filter meetings that have this email as the organizer.'),
    participant_email: z
      .string()
      .optional()
      .describe('Deprecated. Use participants instead. Filter meetings that contain this email as an attendee.'),
  })
  .refine(data => !(data.title !== undefined && data.keyword !== undefined), {
    message: 'title and keyword are mutually exclusive',
    path: ['title'],
  })
  .refine(data => !(data.scope !== undefined && data.keyword === undefined), {
    message: 'keyword is required when scope is provided',
    path: ['scope'],
  });

const ProviderChannelSchema = z.object({
  id: z.string().nullish(),
});

const ProviderMeetingInfoSchema = z.object({
  fred_joined: z.boolean().nullish(),
  silent_meeting: z.boolean().nullish(),
  summary_status: z.string().nullish(),
});

const ProviderSummarySchema = z.object({
  keywords: z.array(z.string()).nullish(),
  action_items: z.array(z.string()).nullish(),
  short_summary: z.string().nullish(),
  meeting_type: z.string().nullish(),
});

const ProviderTranscriptSchema = z.object({
  id: z.string(),
  title: z.string().nullish(),
  date: z.union([z.string(), z.number()]).nullish(),
  duration: z.union([z.number(), z.string()]).nullish(),
  organizer_email: z.string().nullish(),
  host_email: z.string().nullish(),
  participants: z.array(z.string()).nullish(),
  fireflies_users: z.array(z.string()).nullish(),
  transcript_url: z.string().nullish(),
  audio_url: z.string().nullish(),
  video_url: z.string().nullish(),
  meeting_link: z.string().nullish(),
  is_live: z.boolean().nullish(),
  privacy: z.string().nullish(),
  calendar_id: z.string().nullish(),
  cal_id: z.string().nullish(),
  calendar_type: z.string().nullish(),
  channels: z.array(ProviderChannelSchema).nullish(),
  meeting_info: ProviderMeetingInfoSchema.nullish(),
  summary: ProviderSummarySchema.nullish(),
});

export const listTranscriptsOutputSchema = z.object({
  transcripts: z.array(
    z.object({
      id: z.string(),
      title: z.string().optional(),
      date: z.string().optional(),
      duration: z.number().optional(),
      organizer_email: z.string().optional(),
      host_email: z.string().optional(),
      participants: z.array(z.string()).optional(),
      fireflies_users: z.array(z.string()).optional(),
      transcript_url: z.string().optional(),
      audio_url: z.string().optional(),
      video_url: z.string().optional(),
      meeting_link: z.string().optional(),
      is_live: z.boolean().optional(),
      privacy: z.string().optional(),
      calendar_id: z.string().optional(),
      cal_id: z.string().optional(),
      calendar_type: z.string().optional(),
      channels: z.array(z.object({ id: z.string().optional() })).optional(),
      meeting_info: z
        .object({
          fred_joined: z.boolean().optional(),
          silent_meeting: z.boolean().optional(),
          summary_status: z.string().optional(),
        })
        .optional(),
      summary: z
        .object({
          keywords: z.array(z.string()).optional(),
          action_items: z.array(z.string()).optional(),
          short_summary: z.string().optional(),
          meeting_type: z.string().optional(),
        })
        .optional(),
    }),
  ),
  next_skip: z.number().optional(),
});

const GraphQLResponseSchema = z.object({
  data: z
    .object({
      transcripts: z.array(z.unknown()).nullish(),
    })
    .nullish(),
  errors: z.array(z.unknown()).nullish(),
});

export function listTranscriptsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'fireflies_list_transcripts',
    description: 'List transcripts with optional filters.',
    inputSchema: listTranscriptsInputSchema,
    outputSchema: listTranscriptsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listTranscriptsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const query = `
            query Transcripts(
                $fromDate: DateTime
                $toDate: DateTime
                $limit: Int
                $skip: Int
                $title: String
                $keyword: String
                $scope: String
                $userId: String
                $mine: Boolean
                $organizers: [String!]
                $participants: [String!]
                $channelId: String
                $hostEmail: String
                $organizerEmail: String
                $participantEmail: String
            ) {
                transcripts(
                    fromDate: $fromDate
                    toDate: $toDate
                    limit: $limit
                    skip: $skip
                    title: $title
                    keyword: $keyword
                    scope: $scope
                    user_id: $userId
                    mine: $mine
                    organizers: $organizers
                    participants: $participants
                    channel_id: $channelId
                    host_email: $hostEmail
                    organizer_email: $organizerEmail
                    participant_email: $participantEmail
                ) {
                    id
                    title
                    date
                    duration
                    organizer_email
                    host_email
                    participants
                    fireflies_users
                    transcript_url
                    audio_url
                    video_url
                    meeting_link
                    is_live
                    privacy
                    calendar_id
                    cal_id
                    calendar_type
                    channels {
                        id
                    }
                    meeting_info {
                        fred_joined
                        silent_meeting
                        summary_status
                    }
                    summary {
                        keywords
                        action_items
                        short_summary
                        meeting_type
                    }
                }
            }
        `;

      const variables: Record<string, unknown> = {
        fromDate: input.fromDate,
        toDate: input.toDate,
        limit: input.limit,
        skip: input.skip,
        title: input.title,
        keyword: input.keyword,
        scope: input.scope,
        userId: input.user_id,
        mine: input.mine,
        organizers: input.organizers,
        participants: input.participants,
        channelId: input.channel_id,
        hostEmail: input.host_email,
        organizerEmail: input.organizer_email,
        participantEmail: input.participant_email,
      };

      // https://docs.fireflies.ai/graphql-api/query/transcripts
      const response = await platformProxy.post({
        endpoint: '/graphql',
        data: {
          query,
          variables,
        },
        retries: 3,
      });

      const parsedResponse = GraphQLResponseSchema.safeParse(response.data);
      if (!parsedResponse.success) {
        throw new platformProxy.ActionError({
          type: 'invalid_response',
          message: 'Failed to parse provider response.',
        });
      }

      if (parsedResponse.data.errors && parsedResponse.data.errors.length > 0) {
        const firstError = parsedResponse.data.errors[0];
        const errorMessage =
          typeof firstError === 'object' && firstError !== null && 'message' in firstError
            ? String(firstError.message)
            : 'Unknown GraphQL error';
        throw new platformProxy.ActionError({
          type: 'graphql_error',
          message: errorMessage,
        });
      }

      const transcriptsData = parsedResponse.data.data?.transcripts;
      if (!transcriptsData || !Array.isArray(transcriptsData)) {
        return {
          transcripts: [],
          next_skip: undefined,
        };
      }

      const transcripts = transcriptsData.map((item: unknown) => {
        const providerTranscript = ProviderTranscriptSchema.parse(item);
        return {
          id: providerTranscript.id,
          ...(providerTranscript.title != null && { title: providerTranscript.title }),
          ...(providerTranscript.date != null && {
            date:
              typeof providerTranscript.date === 'number' ? String(providerTranscript.date) : providerTranscript.date,
          }),
          ...(providerTranscript.duration != null && {
            duration:
              typeof providerTranscript.duration === 'string'
                ? Number(providerTranscript.duration)
                : providerTranscript.duration,
          }),
          ...(providerTranscript.organizer_email != null && { organizer_email: providerTranscript.organizer_email }),
          ...(providerTranscript.host_email != null && { host_email: providerTranscript.host_email }),
          ...(providerTranscript.participants != null && { participants: providerTranscript.participants }),
          ...(providerTranscript.fireflies_users != null && { fireflies_users: providerTranscript.fireflies_users }),
          ...(providerTranscript.transcript_url != null && { transcript_url: providerTranscript.transcript_url }),
          ...(providerTranscript.audio_url != null && { audio_url: providerTranscript.audio_url }),
          ...(providerTranscript.video_url != null && { video_url: providerTranscript.video_url }),
          ...(providerTranscript.meeting_link != null && { meeting_link: providerTranscript.meeting_link }),
          ...(providerTranscript.is_live != null && { is_live: providerTranscript.is_live }),
          ...(providerTranscript.privacy != null && { privacy: providerTranscript.privacy }),
          ...(providerTranscript.calendar_id != null && { calendar_id: providerTranscript.calendar_id }),
          ...(providerTranscript.cal_id != null && { cal_id: providerTranscript.cal_id }),
          ...(providerTranscript.calendar_type != null && { calendar_type: providerTranscript.calendar_type }),
          ...(providerTranscript.channels != null && {
            channels: providerTranscript.channels.map(channel => ({
              ...(channel.id != null && { id: channel.id }),
            })),
          }),
          ...(providerTranscript.meeting_info != null && {
            meeting_info: {
              ...(providerTranscript.meeting_info.fred_joined != null && {
                fred_joined: providerTranscript.meeting_info.fred_joined,
              }),
              ...(providerTranscript.meeting_info.silent_meeting != null && {
                silent_meeting: providerTranscript.meeting_info.silent_meeting,
              }),
              ...(providerTranscript.meeting_info.summary_status != null && {
                summary_status: providerTranscript.meeting_info.summary_status,
              }),
            },
          }),
          ...(providerTranscript.summary != null && {
            summary: {
              ...(providerTranscript.summary.keywords != null && { keywords: providerTranscript.summary.keywords }),
              ...(providerTranscript.summary.action_items != null && {
                action_items: providerTranscript.summary.action_items,
              }),
              ...(providerTranscript.summary.short_summary != null && {
                short_summary: providerTranscript.summary.short_summary,
              }),
              ...(providerTranscript.summary.meeting_type != null && {
                meeting_type: providerTranscript.summary.meeting_type,
              }),
            },
          }),
        };
      });

      const currentLimit = input.limit ?? 50;
      const currentSkip = input.skip ?? 0;
      const nextSkip = transcripts.length === currentLimit ? currentSkip + transcripts.length : undefined;

      return {
        transcripts,
        ...(nextSkip != null && { next_skip: nextSkip }),
      };
    },
  });
}
