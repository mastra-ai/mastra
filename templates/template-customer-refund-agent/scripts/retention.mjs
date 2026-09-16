import { createClient } from "@libsql/client";
import { LibSQLStore } from "@mastra/libsql";
import { requireLocalDatabaseUrl } from "../src/mastra/lib/database-url.ts";
import { CaseStoreRetention } from "../src/mastra/lib/case-store-retention.ts";
import { retentionPolicyFromEnvironment } from "../src/mastra/lib/case-store-shared.ts";
import { purgeExpiredWorkflowSnapshots } from "../src/mastra/runtime/workflow-snapshot-retention.ts";

function retentionClock() {
  const supplied = process.env.SUPPORT_TEST_RETENTION_NOW;
  if (supplied !== undefined) {
    if (process.env.NODE_ENV !== "test")
      throw new Error(
        "SUPPORT_TEST_RETENTION_NOW is available only under NODE_ENV=test.",
      );
    const parsed = new Date(supplied);
    if (Number.isNaN(parsed.getTime()))
      throw new Error("SUPPORT_TEST_RETENTION_NOW must be an ISO timestamp.");
    return parsed;
  }
  return new Date();
}

async function tableExists(client, name) {
  return Boolean(
    (
      await client.execute({
        sql: "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?",
        args: [name],
      })
    ).rows[0],
  );
}

const url = requireLocalDatabaseUrl();
const policy = retentionPolicyFromEnvironment();
const client = createClient({ url, timeout: 0 });

try {
  for (const table of [
    "support_cases",
    "support_messages",
    "support_turns",
    "support_dispatch",
    "support_outbox",
    "support_decisions",
    "support_actions",
    "support_feedback",
    "support_audit",
    "support_supervisor_executions",
    "support_idempotency",
    "support_stripe_refund_attempts",
    "support_subscription_cancellation_attempts",
    "support_stripe_webhook_receipts",
  ])
    if (!(await tableExists(client, table)))
      throw new Error(
        `Refusing retention cleanup: ${table} is missing. Start the local app once so its supported migrations finish first.`,
      );
  const caseColumns = await client.execute("PRAGMA table_info(support_cases)");
  if (!caseColumns.rows.some((column) => column.name === "accepted_at"))
    throw new Error(
      "Refusing retention cleanup: support schema v9 acceptance-time migration is missing. Start the local app once so its supported migrations finish first.",
    );
  const feedbackMigration = await client.execute({
    sql: "SELECT 1 FROM support_schema_migrations WHERE version = 10",
  });
  if (!feedbackMigration.rows[0])
    throw new Error(
      "Refusing retention cleanup: support schema v10 feedback migration is missing. Start the local app once so its supported migrations finish first.",
    );

  const cases = await new CaseStoreRetention(client).enforceRetention(
    retentionClock,
    policy,
  );
  const storage = new LibSQLStore({
    id: "support-retention-cli",
    client,
    maxRetries: 5,
    initialBackoffMs: 5,
    retention: {
      memory: {
        messages: { maxAge: `${policy.caseDays}d`, batchSize: 500 },
        resources: { maxAge: `${policy.caseDays}d`, batchSize: 500 },
        threads: { maxAge: `${policy.caseDays}d`, batchSize: 500 },
      },
      observability: {
        spans: { maxAge: `${policy.traceDays}d`, batchSize: 500 },
      },
    },
  });
  await storage.init();
  const snapshotsDeleted = await purgeExpiredWorkflowSnapshots(storage, cases);
  const mastra = await storage.prune({ maxBatches: 10, maxRows: 5_000 });
  console.log(JSON.stringify({ policy, cases, snapshotsDeleted, mastra }));
} finally {
  client.close();
}
