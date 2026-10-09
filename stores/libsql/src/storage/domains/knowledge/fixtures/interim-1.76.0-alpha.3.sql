-- Knowledge tables created by the interim canonical-model release (main 38643beb41a, @mastra/core 1.76.0-alpha.3),
-- captured from sqlite_master after KnowledgeLibSQL.init().
CREATE TABLE mastra_knowledge_access_state (
  "id" TEXT NOT NULL PRIMARY KEY,
  "epoch" INTEGER NOT NULL,
  "schemaVersion" INTEGER NOT NULL
);
CREATE TABLE mastra_knowledge_activity (
  "id" TEXT NOT NULL PRIMARY KEY,
  "action" TEXT NOT NULL,
  "targetType" TEXT,
  "targetId" TEXT,
  "contextScopeId" TEXT,
  "importRunId" TEXT,
  "details" TEXT,
  "createdAt" TEXT NOT NULL,
  "recordType" TEXT,
  "recordId" TEXT,
  "scope" TEXT,
  "scopeKey" TEXT,
  "sourceThreadId" TEXT
);
CREATE TABLE mastra_knowledge_import_runs (
  "id" TEXT NOT NULL PRIMARY KEY,
  "importerId" TEXT NOT NULL,
  "binding" TEXT NOT NULL,
  "importKind" TEXT NOT NULL,
  "triggerKind" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "error" TEXT,
  "transcriptThreadId" TEXT,
  "traceId" TEXT,
  "queuedAt" TEXT NOT NULL,
  "startedAt" TEXT,
  "completedAt" TEXT
);
CREATE TABLE mastra_knowledge_import_state (
  "importerId" TEXT NOT NULL,
  "binding" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  PRIMARY KEY ("importerId", "binding", "key")
);
CREATE TABLE mastra_knowledge_mentions (
  "recordId" TEXT NOT NULL,
  "targetNodeId" TEXT,
  "sourceType" TEXT,
  "sourceId" TEXT,
  PRIMARY KEY ("recordId", "sourceId")
);
CREATE TABLE mastra_knowledge_node_addresses (
  "source" TEXT NOT NULL,
  "address" TEXT NOT NULL,
  "nodeId" TEXT NOT NULL,
  PRIMARY KEY ("source", "address")
);
CREATE TABLE mastra_knowledge_node_scopes (
  "nodeId" TEXT NOT NULL,
  "scopeNodeId" TEXT NOT NULL,
  "addedAt" TEXT NOT NULL,
  PRIMARY KEY ("nodeId", "scopeNodeId")
);
CREATE TABLE mastra_knowledge_nodes (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "kind" TEXT,
  "isScope" INTEGER NOT NULL,
  "metadata" TEXT,
  "version" INTEGER NOT NULL,
  "createdAt" TEXT NOT NULL,
  "updatedAt" TEXT NOT NULL,
  "deletedAt" TEXT,
  "deletedBy" TEXT,
  "type" TEXT,
  "canonicalName" TEXT,
  "content" TEXT,
  "description" TEXT,
  "scope" TEXT,
  "scopeKey" TEXT,
  "mergedInto" TEXT
);
CREATE TABLE mastra_knowledge_proposals (
  "id" TEXT NOT NULL PRIMARY KEY,
  "targetType" TEXT NOT NULL,
  "targetId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "changes" TEXT NOT NULL,
  "reason" TEXT,
  "proposerContextScopeId" TEXT NOT NULL,
  "expectedVersion" INTEGER NOT NULL,
  "status" TEXT NOT NULL,
  "reviewerContextScopeId" TEXT,
  "reviewedAt" TEXT,
  "createdAt" TEXT NOT NULL
);
CREATE TABLE mastra_knowledge_record_scopes (
  "recordId" TEXT NOT NULL,
  "scopeNodeId" TEXT NOT NULL,
  "addedAt" TEXT NOT NULL,
  PRIMARY KEY ("recordId", "scopeNodeId")
);
CREATE TABLE mastra_knowledge_records (
  "id" TEXT NOT NULL PRIMARY KEY,
  "node" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "metadata" TEXT,
  "version" INTEGER NOT NULL,
  "capturedAt" TEXT NOT NULL,
  "updatedAt" TEXT NOT NULL,
  "deletedAt" TEXT,
  "deletedBy" TEXT,
  "scope" TEXT,
  "scopeKey" TEXT,
  "sourceThreadId" TEXT,
  "when" TEXT
);
CREATE TABLE mastra_knowledge_scope_addresses (
  "address" TEXT NOT NULL PRIMARY KEY,
  "scopeNodeId" TEXT NOT NULL
);
CREATE TABLE mastra_knowledge_scope_grants (
  "scopeNodeId" TEXT NOT NULL,
  "scopeRefId" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "canSuggest" INTEGER,
  PRIMARY KEY ("scopeNodeId", "scopeRefId")
);
CREATE TABLE mastra_knowledge_semantic_outbox (
  "id" TEXT NOT NULL PRIMARY KEY,
  "idempotencyKey" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "documentType" TEXT NOT NULL,
  "operation" TEXT NOT NULL,
  "scope" TEXT NOT NULL,
  "scopeKey" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "attempts" INTEGER NOT NULL,
  "availableAt" TEXT NOT NULL,
  "claimedAt" TEXT,
  "claimedBy" TEXT,
  "createdAt" TEXT NOT NULL,
  "completedAt" TEXT
);
CREATE INDEX idx_knowledge_activity_import_run ON "mastra_knowledge_activity" (importRunId, id DESC);
CREATE INDEX idx_knowledge_activity_latest ON "mastra_knowledge_activity" (id DESC);
CREATE INDEX idx_knowledge_activity_scope ON "mastra_knowledge_activity" (scopeKey, id DESC);
CREATE INDEX idx_knowledge_import_runs_lookup ON "mastra_knowledge_import_runs" (importerId, binding, queuedAt DESC);
CREATE INDEX idx_knowledge_mentions_record ON "mastra_knowledge_mentions" (recordId, sourceType, sourceId);
CREATE INDEX idx_knowledge_node_addresses_node ON "mastra_knowledge_node_addresses" (nodeId);
CREATE INDEX idx_knowledge_node_scopes_scope ON "mastra_knowledge_node_scopes" (scopeNodeId, nodeId);
CREATE UNIQUE INDEX idx_knowledge_nodes_identity ON "mastra_knowledge_nodes" (type, scopeKey, canonicalName);
CREATE INDEX idx_knowledge_nodes_name ON "mastra_knowledge_nodes" (type, canonicalName);
CREATE INDEX idx_knowledge_nodes_scope ON "mastra_knowledge_nodes" (scopeKey, type);
CREATE INDEX idx_knowledge_outbox_claim ON "mastra_knowledge_semantic_outbox" (status, availableAt, createdAt);
CREATE UNIQUE INDEX idx_knowledge_outbox_idempotency ON "mastra_knowledge_semantic_outbox" (idempotencyKey);
CREATE INDEX idx_knowledge_record_scopes_scope ON "mastra_knowledge_record_scopes" (scopeNodeId, recordId);
CREATE INDEX idx_knowledge_records_node_latest ON "mastra_knowledge_records" (node, id DESC);
CREATE INDEX idx_knowledge_records_scope ON "mastra_knowledge_records" (scopeKey, id);
CREATE INDEX idx_knowledge_records_thread_latest ON "mastra_knowledge_records" (sourceThreadId, id DESC);
CREATE INDEX idx_knowledge_scope_grants_ref ON "mastra_knowledge_scope_grants" (scopeRefId, scopeNodeId);
