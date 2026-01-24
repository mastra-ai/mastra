/**
 * Email template types.
 */
export type EmailTemplate =
  | 'team_invite'
  | 'build_failed'
  | 'deployment_ready'
  | 'license_expiring';

/**
 * Email options.
 */
export interface EmailOptions {
  to: string;
  subject: string;
  template: EmailTemplate;
  data: Record<string, unknown>;
}

/**
 * Abstract interface for email operations.
 */
export interface EmailProvider {
  /**
   * Send an email.
   */
  send(options: EmailOptions): Promise<void>;

  /**
   * Send a batch of emails.
   */
  sendBatch(emails: EmailOptions[]): Promise<void>;
}
