/**
 * Fireflies webhook payload types, written by hand from Fireflies' webhook
 * guides for V2 (https://docs.fireflies.ai/graphql-api/webhooks-v2) and the
 * deprecated V1 (https://docs.fireflies.ai/graphql-api/webhooks). Connect
 * names a V2 delivery by its `event` and a V1 delivery by its `eventType`.
 */

/** A Fireflies V2 webhook body. */
export interface FirefliesWebhook<Event extends string> {
  event: Event;
  /** When the event happened, in Unix milliseconds. */
  timestamp: number;
  meeting_id: string;
  /** The reference you passed when uploading the meeting, if any. */
  client_reference_id?: string;
  /** Set only on a resend after the meeting's notes changed, in Unix milliseconds. */
  reprocessed_at?: number;
}

/** Fireflies webhook payloads by Connect event type. */
export interface FirefliesWebhookPayloads {
  'meeting.bot_joined': FirefliesWebhook<'meeting.bot_joined'>;
  'meeting.summarized': FirefliesWebhook<'meeting.summarized'>;
  'meeting.transcribed': FirefliesWebhook<'meeting.transcribed'>;
  /** @deprecated Fireflies V1 webhooks; use `meeting.transcribed`. */
  'Transcription completed': {
    meetingId: string;
    eventType: 'Transcription completed';
    clientReferenceId?: string;
  };
}
