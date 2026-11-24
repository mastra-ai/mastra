import type { GithubWebhookPayloads } from './github.generated.js';
import type { GitlabWebhookPayloads } from './gitlab.js';
import type { IncidentIoWebhookPayloads } from './incident-io.generated.js';
import type { JiraWebhookPayloads } from './jira.generated.js';
import type { LinearWebhookPayloads } from './linear.generated.js';

export type {
  GithubWebhookPayloads,
  GitlabWebhookPayloads,
  IncidentIoWebhookPayloads,
  JiraWebhookPayloads,
  LinearWebhookPayloads,
};

/**
 * Provider webhook payload types, by integration id and then Connect event
 * type, built from each provider's published contract.
 *
 * Add an integration, or events of one, by declaration merging:
 *
 * @example
 * ```ts
 * declare module '@mastra/connect' {
 *   interface ConnectEventPayloads {
 *     slack: { 'message': { type: 'event_callback'; event: { text: string } } };
 *   }
 * }
 * ```
 */
export interface ConnectEventPayloads {
  github: GithubWebhookPayloads;
  gitlab: GitlabWebhookPayloads;
  'incident-io': IncidentIoWebhookPayloads;
  jira: JiraWebhookPayloads;
  linear: LinearWebhookPayloads;
}
