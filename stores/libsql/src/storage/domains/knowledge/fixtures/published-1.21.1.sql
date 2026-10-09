CREATE TABLE mastra_knowledge_activity (
  "id" TEXT NOT NULL PRIMARY KEY,
  "action" TEXT NOT NULL,
  "recordType" TEXT NOT NULL,
  "recordId" TEXT NOT NULL,
  "scope" TEXT NOT NULL,
  "scopeKey" TEXT NOT NULL,
  "sourceThreadId" TEXT,
  "createdAt" TEXT NOT NULL
);
CREATE TABLE mastra_knowledge_cursors (
  "sourceThreadId" TEXT NOT NULL,
  "agent" TEXT NOT NULL,
  "lastKnowledgeId" TEXT NOT NULL,
  "updatedAt" TEXT NOT NULL,
  PRIMARY KEY ("sourceThreadId", "agent")
);
CREATE TABLE mastra_knowledge_mentions (
  "sourceType" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "recordId" TEXT NOT NULL,
  PRIMARY KEY ("sourceType", "sourceId", "recordId")
);
CREATE TABLE mastra_knowledge_nodes (
  "id" TEXT NOT NULL PRIMARY KEY,
  "type" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "canonicalName" TEXT NOT NULL,
  "kind" TEXT,
  "content" TEXT,
  "scope" TEXT NOT NULL,
  "scopeKey" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "mergedInto" TEXT,
  "createdAt" TEXT NOT NULL,
  "updatedAt" TEXT NOT NULL
);
CREATE TABLE mastra_knowledge_records (
  "id" TEXT NOT NULL PRIMARY KEY,
  "node" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "scope" TEXT NOT NULL,
  "scopeKey" TEXT NOT NULL,
  "sourceThreadId" TEXT NOT NULL,
  "capturedAt" TEXT NOT NULL,
  "when" TEXT,
  "maxScope" TEXT,
  "metadata" TEXT,
  "deletedAt" TEXT,
  "deletedBy" TEXT
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
CREATE INDEX idx_knowledge_activity_latest ON "mastra_knowledge_activity" (id DESC);
CREATE INDEX idx_knowledge_mentions_record ON "mastra_knowledge_mentions" (recordId, sourceType, sourceId);
CREATE UNIQUE INDEX idx_knowledge_nodes_identity ON "mastra_knowledge_nodes" (type, scopeKey, canonicalName);
CREATE INDEX idx_knowledge_nodes_scope ON "mastra_knowledge_nodes" (scopeKey, type);
CREATE INDEX idx_knowledge_outbox_claim ON "mastra_knowledge_semantic_outbox" (status, availableAt, createdAt);
CREATE UNIQUE INDEX idx_knowledge_outbox_idempotency ON "mastra_knowledge_semantic_outbox" (idempotencyKey);
CREATE INDEX idx_knowledge_records_node_latest ON "mastra_knowledge_records" (node, id DESC);
CREATE INDEX idx_knowledge_records_thread_latest ON "mastra_knowledge_records" (sourceThreadId, id DESC);
