// Only allowlisted scalar observations cross into the analytics read model.
// SQL triggers keep each observation atomic with its authoritative mutation.
const sources = [
  {
    table: 'workflow_runs',
    kind: 'workflow',
    status:
      "CASE WHEN NEW.status IN ('running','suspended','completed','failed','pending') THEN NEW.status ELSE 'other' END",
    start: 'NEW.started_at',
    finish: 'NEW.finished_at',
    triage: 'NEW.triage_result_json IS NOT NULL',
    trace: 'NEW.trace_context_json IS NOT NULL',
  },
  {
    table: 'approvals',
    kind: 'approval',
    status: "COALESCE(NEW.decision, CASE WHEN NEW.expiry_resumed_at IS NOT NULL THEN 'expired' ELSE 'pending' END)",
    start: 'NEW.requested_at',
    finish: 'COALESCE(NEW.decided_at, NEW.expiry_resumed_at)',
    triage: '0',
    trace: '0',
  },
  {
    table: 'provider_deliveries',
    kind: 'provider',
    status:
      "CASE WHEN NEW.status IN ('pending','delivering','succeeded','retry','exhausted','uncertain') THEN NEW.status ELSE 'other' END",
    start: 'NULL',
    finish: 'NEW.observed_at',
    triage: '0',
    trace: '0',
  },
  {
    table: 'containment_action_attempts',
    kind: 'containment',
    status: 'NEW.status',
    start: 'NEW.started_at',
    finish: 'NEW.finished_at',
    triage: '0',
    trace: '0',
  },
] as const;

const evidenceProjection = `SELECT NEW.tenant_id, NEW.incident_id, 'evidence-source', NEW.id || ':' || source,
  CASE WHEN EXISTS(SELECT 1 FROM json_each(NEW.payload_json,'$.missingData') gap
    WHERE json_extract(gap.value,'$.source') = source AND json_extract(gap.value,'$.reason') IN ('TIMEOUT','UNAVAILABLE','RATE_LIMITED','INVALID_RESPONSE','ABORTED','NOT_FOUND')) THEN 'failed'
  WHEN EXISTS(SELECT 1 FROM json_each(NEW.payload_json,'$.missingData') gap
    WHERE json_extract(gap.value,'$.source') = source) THEN 'missing' ELSE 'present' END,
  NULL, NEW.occurred_at, 0, 0`;
const evidenceSources = `(SELECT 'identity' AS source UNION ALL SELECT 'endpoint' UNION ALL SELECT 'cloud')`;

export const analyticsJournalStatements = [
  `CREATE TABLE analytics_source_identity (id TEXT PRIMARY KEY) STRICT`,
  `INSERT INTO analytics_source_identity VALUES (lower(hex(randomblob(16))))`,
  `CREATE TRIGGER analytics_identity_no_update BEFORE UPDATE ON analytics_source_identity BEGIN SELECT RAISE(ABORT,'IMMUTABLE_IDENTITY'); END`,
  `CREATE TRIGGER analytics_identity_no_delete BEFORE DELETE ON analytics_source_identity BEGIN SELECT RAISE(ABORT,'IMMUTABLE_IDENTITY'); END`,
  `CREATE TRIGGER analytics_identity_no_insert BEFORE INSERT ON analytics_source_identity BEGIN SELECT RAISE(ABORT,'IMMUTABLE_IDENTITY'); END`,
  `CREATE TABLE analytics_journal (
    sequence INTEGER PRIMARY KEY AUTOINCREMENT, tenant_id TEXT NOT NULL,
    incident_id TEXT NOT NULL, kind TEXT NOT NULL, entity_id TEXT NOT NULL,
    status TEXT NOT NULL, started_at TEXT, finished_at TEXT, triaged INTEGER NOT NULL,
    trace_present INTEGER NOT NULL, observed_at TEXT
  ) STRICT`,
  `CREATE INDEX idx_analytics_tenant_sequence ON analytics_journal(tenant_id, sequence)`,
  ...sources.flatMap(source => {
    const projection = `NEW.tenant_id, NEW.incident_id, '${source.kind}', NEW.id,
      ${source.status}, ${source.start}, ${source.finish}, ${source.triage}, ${source.trace}`;
    return [
      `INSERT INTO analytics_journal(tenant_id,incident_id,kind,entity_id,status,started_at,finished_at,triaged,trace_present,observed_at)
        SELECT ${projection.replaceAll('NEW.', '')}, NULL FROM ${source.table}`,
      ...['INSERT', 'UPDATE'].map(
        operation => `CREATE TRIGGER analytics_${source.table}_${operation.toLowerCase()}
        AFTER ${operation} ON ${source.table} BEGIN
          INSERT INTO analytics_journal(tenant_id,incident_id,kind,entity_id,status,started_at,finished_at,triaged,trace_present,observed_at)
          VALUES (${projection}, strftime('%Y-%m-%dT%H:%M:%fZ','now'));
        END`,
      ),
    ];
  }),
  `INSERT INTO analytics_journal(tenant_id,incident_id,kind,entity_id,status,started_at,finished_at,triaged,trace_present,observed_at)
    ${evidenceProjection},NULL FROM timeline_events NEW CROSS JOIN ${evidenceSources} WHERE NEW.type='evidence.correlated'`,
  `CREATE TRIGGER analytics_evidence_correlated AFTER INSERT ON timeline_events WHEN NEW.type='evidence.correlated' BEGIN
    INSERT INTO analytics_journal(tenant_id,incident_id,kind,entity_id,status,started_at,finished_at,triaged,trace_present,observed_at)
    ${evidenceProjection},strftime('%Y-%m-%dT%H:%M:%fZ','now') FROM ${evidenceSources}; END`,
  `CREATE TRIGGER analytics_journal_no_update BEFORE UPDATE ON analytics_journal BEGIN SELECT RAISE(ABORT,'APPEND_ONLY'); END`,
  `CREATE TRIGGER analytics_journal_no_delete BEFORE DELETE ON analytics_journal BEGIN SELECT RAISE(ABORT,'APPEND_ONLY'); END`,
] as const;
