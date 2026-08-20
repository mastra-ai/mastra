import { readFile } from 'node:fs/promises';
import { apKpiLogPath, type ApKpiEvent } from '../mastra/monitoring/ap-kpis.ts';
import { buildApKpiReport } from '../mastra/monitoring/ap-kpi-report.ts';

const path = apKpiLogPath();
const rows: ApKpiEvent[] = (await readFile(path, 'utf8').catch(() => ''))
  .split('\n')
  .filter(Boolean)
  .map(line => JSON.parse(line));
console.log(JSON.stringify(buildApKpiReport(rows), null, 2));
