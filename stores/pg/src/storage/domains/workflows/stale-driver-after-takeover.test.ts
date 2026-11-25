import { afterAll, beforeAll, describe } from 'vitest';
import { PostgresStore } from '../..';
import { describeStaleDriverCases } from '../../../../../../packages/core/src/workflows/test-utils/stale-driver-cases';
import { TEST_CONFIG } from '../../test-utils';

// A process that stalls past its run lease (a cut database link, a frozen event loop) must not
// overwrite a run another process took over: Postgres refuses its saves.
describe('Postgres default-engine run taken over by another process', () => {
  const schemaName = `stale_driver_${Date.now()}`;
  const storage = new PostgresStore({ ...TEST_CONFIG, id: 'stale-driver', schemaName });
  beforeAll(async () => {
    await storage.init();
  });
  afterAll(async () => {
    await storage.db.none(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
    await storage.close();
  });

  describeStaleDriverCases({ getStorage: () => storage });
});
