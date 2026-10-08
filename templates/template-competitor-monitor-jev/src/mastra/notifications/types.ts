import type { ReportChange } from '../lib/reporting';

export type ChangeNotification = {
  eventId: string;
  runId: string;
  monitorId: string;
  monitorName: string;
  date: string;
  changes: ReportChange[];
};

/** Destinations must deduplicate eventId if replay after delivery but before its durable receipt matters. */
export interface NotificationProvider {
  id: string;
  notify(event: ChangeNotification): Promise<void>;
}
