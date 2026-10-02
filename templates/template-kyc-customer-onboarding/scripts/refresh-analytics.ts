import { z } from 'zod';

import { loadConfig } from '../src/config/load-config.js';
import { SystemClock } from '../src/providers/local/deterministic-primitives.js';
import { KycMetricsService } from '../src/services/kyc-metrics.js';
import { initializeStorage } from '../src/storage/initialize-storage.js';

const storage = await initializeStorage(loadConfig());
try {
  const metrics = new KycMetricsService(storage.operational, storage.analytics, new SystemClock());
  const pending = await storage.operational.execute(
    `SELECT DISTINCT tenant_id FROM analytics_outbox
     WHERE projected_at IS NULL ORDER BY tenant_id`,
  );
  const projectedByTenant: Record<string, number> = {};
  for (const row of pending.rows) {
    const tenantId = z.string().parse(row.tenant_id);
    projectedByTenant[tenantId] = await metrics.projectPending(tenantId);
  }
  process.stdout.write(`${JSON.stringify({ projectedByTenant }, null, 2)}\n`);
} finally {
  storage.close();
}
