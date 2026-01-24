import type { EmailOptions, EmailProvider } from './base';

/**
 * Console email provider for development.
 * Logs emails to console instead of sending.
 */
export class ConsoleEmailProvider implements EmailProvider {
  async send(options: EmailOptions): Promise<void> {
    console.info('[Email]', {
      to: options.to,
      subject: options.subject,
      template: options.template,
      data: options.data,
    });
  }

  async sendBatch(emails: EmailOptions[]): Promise<void> {
    for (const email of emails) {
      await this.send(email);
    }
  }
}
