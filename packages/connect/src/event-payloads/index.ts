import type { ClerkWebhookPayloads } from './clerk.generated.js';
import type { ElevenLabsWebhookPayloads } from './elevenlabs.generated.js';
import type { FirefliesWebhookPayloads } from './fireflies.js';
import type { GithubWebhookPayloads } from './github.generated.js';
import type { GitlabWebhookPayloads } from './gitlab.js';
import type { HubspotWebhookPayloads } from './hubspot.js';
import type { IncidentIoWebhookPayloads } from './incident-io.generated.js';
import type { JiraWebhookPayloads } from './jira.generated.js';
import type { LinearWebhookPayloads } from './linear.generated.js';
import type { NotionWebhookPayloads } from './notion.js';
import type { OpenAiWebhookPayloads } from './openai.generated.js';
import type { OutlookWebhookPayloads } from './outlook.js';
import type { ResendWebhookPayloads } from './resend.generated.js';
import type { SendgridWebhookPayloads } from './sendgrid.js';
import type { SlackWebhookPayloads } from './slack.js';
import type { SupabaseWebhookPayloads } from './supabase.js';
import type { TelegramWebhookPayloads } from './telegram.generated.js';
import type { WorkosWebhookPayloads } from './workos.generated.js';
import type { ZendeskWebhookPayloads } from './zendesk.js';

export type {
  ClerkWebhookPayloads,
  ElevenLabsWebhookPayloads,
  FirefliesWebhookPayloads,
  GithubWebhookPayloads,
  GitlabWebhookPayloads,
  HubspotWebhookPayloads,
  IncidentIoWebhookPayloads,
  JiraWebhookPayloads,
  LinearWebhookPayloads,
  NotionWebhookPayloads,
  OpenAiWebhookPayloads,
  OutlookWebhookPayloads,
  ResendWebhookPayloads,
  SendgridWebhookPayloads,
  SlackWebhookPayloads,
  SupabaseWebhookPayloads,
  TelegramWebhookPayloads,
  WorkosWebhookPayloads,
  ZendeskWebhookPayloads,
};
export type { SlackEventCallback } from './slack.js';

/**
 * Provider webhook payload types, by provider and then Connect event
 * type, built from each provider's published contract.
 *
 * Add a provider by declaration merging. Add events to a provider whose
 * payload map is an interface, such as `SlackWebhookPayloads`, the
 * same way.
 *
 * @example
 * ```ts
 * declare module '@mastra/connect' {
 *   interface ConnectEventPayloads {
 *     acme: { 'order.created': { orderId: string } };
 *   }
 *   interface SlackWebhookPayloads {
 *     channel_rename: SlackEventCallback<{ type: 'channel_rename'; channel: { id: string; name: string } }>;
 *   }
 * }
 * ```
 */
export interface ConnectEventPayloads {
  clerk: ClerkWebhookPayloads;
  elevenlabs: ElevenLabsWebhookPayloads;
  fireflies: FirefliesWebhookPayloads;
  github: GithubWebhookPayloads;
  gitlab: GitlabWebhookPayloads;
  hubspot: HubspotWebhookPayloads;
  'incident-io': IncidentIoWebhookPayloads;
  jira: JiraWebhookPayloads;
  linear: LinearWebhookPayloads;
  notion: NotionWebhookPayloads;
  openai: OpenAiWebhookPayloads;
  outlook: OutlookWebhookPayloads;
  resend: ResendWebhookPayloads;
  sendgrid: SendgridWebhookPayloads;
  slack: SlackWebhookPayloads;
  supabase: SupabaseWebhookPayloads;
  telegram: TelegramWebhookPayloads;
  workos: WorkosWebhookPayloads;
  zendesk: ZendeskWebhookPayloads;
}
