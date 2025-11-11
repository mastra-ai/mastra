// @ts-nocheck
import { PostgresStore } from '@mastra/stores/pg';

const storage = new PostgresStore({ id: 'storage', connectionString: '' });

const runs = await storage.getWorkflowRuns({ fromDate, toDate });

const other = { getWorkflowRuns: () => [] };
other.getWorkflowRuns({});
