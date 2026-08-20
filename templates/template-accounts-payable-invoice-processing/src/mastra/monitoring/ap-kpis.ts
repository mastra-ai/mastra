import { appendFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export type ApKpiEvent = {
  runId: string | null;
  recordedAt: string;
  executionStatus: string | null;
  disposition: string | null;
  reasons: string[];
  reviewTypes: string[];
  signals: string[];
  adaptations: string[];
  postingStatus: string | null;
  integrationFailure: boolean;
  approvalPending: boolean;
  approvalState: 'not_applicable' | 'pending' | 'approved' | 'rejected' | 'resume_failed';
};

export const apKpiLogPath = () =>
  process.env.AP_KPI_LOG_PATH?.trim() ||
  resolve(fileURLToPath(new URL('../../../', import.meta.url)), 'data/ap-kpis.ndjson');
export async function recordApKpi(event: ApKpiEvent) {
  try {
    const path = apKpiLogPath();
    await mkdir(dirname(path), { recursive: true, mode: 0o700 });
    await appendFile(path, `${JSON.stringify(event)}\n`, { mode: 0o600 });
    return true;
  } catch (error) {
    console.error('AP KPI persistence failed; financial workflow result is unchanged', error);
    return false;
  }
}
