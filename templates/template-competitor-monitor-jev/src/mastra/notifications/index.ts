import { MarkdownReportProvider } from './markdown-report';
import type { NotificationProvider } from './types';

export type { ChangeNotification, NotificationProvider } from './types';

/** Enable providers here. Each instance in this array receives changed scheduled runs. */
export function createNotificationProviders(reportsDir: string): NotificationProvider[] {
  return [new MarkdownReportProvider(reportsDir)];
}
