import type { ReportChange } from '../lib/reporting';

export type ChangeNotification = {
  eventId: string;
  runId: string;
  monitorId: string;
  monitorName: string;
  date: string;
  changes: ReportChange[];
};

/** Destinations must deduplicate eventId and honor abortSignal before external side effects. */
export interface NotificationProvider {
  id: string;
  notify(event: ChangeNotification, options?: { abortSignal?: AbortSignal }): Promise<void>;
}
