-- Knowledge tables created by published @mastra/pg 1.29.0 (PostgresStore.init() + getStore('knowledge')),
-- captured with pg_dump --schema-only and unqualified so a test can load it into any schema.
CREATE TABLE mastra_knowledge_activity (
    id text NOT NULL,
    action text NOT NULL,
    "recordType" text NOT NULL,
    "recordId" text NOT NULL,
    scope jsonb NOT NULL,
    "scopeKey" text NOT NULL,
    "sourceThreadId" text,
    "createdAt" timestamp without time zone NOT NULL,
    "createdAtZ" timestamp with time zone DEFAULT now()
);
CREATE TABLE mastra_knowledge_cursors (
    "sourceThreadId" text NOT NULL,
    agent text NOT NULL,
    "lastKnowledgeId" text NOT NULL,
    "updatedAt" timestamp without time zone NOT NULL,
    "updatedAtZ" timestamp with time zone DEFAULT now()
);
CREATE TABLE mastra_knowledge_mentions (
    "sourceType" text NOT NULL,
    "sourceId" text NOT NULL,
    "recordId" text NOT NULL
);
CREATE TABLE mastra_knowledge_nodes (
    id text NOT NULL,
    type text NOT NULL,
    name text NOT NULL,
    "canonicalName" text NOT NULL,
    kind text,
    content text,
    description text,
    scope jsonb NOT NULL,
    "scopeKey" text NOT NULL,
    version integer NOT NULL,
    "mergedInto" text,
    "createdAt" timestamp without time zone NOT NULL,
    "updatedAt" timestamp without time zone NOT NULL,
    "createdAtZ" timestamp with time zone DEFAULT now(),
    "updatedAtZ" timestamp with time zone DEFAULT now()
);
CREATE TABLE mastra_knowledge_records (
    id text NOT NULL,
    node text NOT NULL,
    text text NOT NULL,
    scope jsonb NOT NULL,
    "scopeKey" text NOT NULL,
    "sourceThreadId" text NOT NULL,
    "capturedAt" timestamp without time zone NOT NULL,
    "when" timestamp without time zone,
    "maxScope" text,
    metadata jsonb,
    "deletedAt" timestamp without time zone,
    "deletedBy" text,
    "capturedAtZ" timestamp with time zone DEFAULT now(),
    "whenZ" timestamp with time zone DEFAULT now(),
    "deletedAtZ" timestamp with time zone DEFAULT now()
);
CREATE TABLE mastra_knowledge_semantic_outbox (
    id text NOT NULL,
    "idempotencyKey" text NOT NULL,
    "documentId" text NOT NULL,
    "documentType" text NOT NULL,
    operation text NOT NULL,
    scope jsonb NOT NULL,
    "scopeKey" text NOT NULL,
    status text NOT NULL,
    attempts integer NOT NULL,
    "availableAt" timestamp without time zone NOT NULL,
    "claimedAt" timestamp without time zone,
    "claimedBy" text,
    "createdAt" timestamp without time zone NOT NULL,
    "completedAt" timestamp without time zone,
    "availableAtZ" timestamp with time zone DEFAULT now(),
    "claimedAtZ" timestamp with time zone DEFAULT now(),
    "createdAtZ" timestamp with time zone DEFAULT now(),
    "completedAtZ" timestamp with time zone DEFAULT now()
);
ALTER TABLE ONLY mastra_knowledge_activity
    ADD CONSTRAINT mastra_knowledge_activity_pkey PRIMARY KEY (id);
ALTER TABLE ONLY mastra_knowledge_cursors
    ADD CONSTRAINT mastra_knowledge_cursors_pkey PRIMARY KEY ("sourceThreadId", agent);
ALTER TABLE ONLY mastra_knowledge_mentions
    ADD CONSTRAINT mastra_knowledge_mentions_pkey PRIMARY KEY ("sourceType", "sourceId", "recordId");
ALTER TABLE ONLY mastra_knowledge_nodes
    ADD CONSTRAINT mastra_knowledge_nodes_pkey PRIMARY KEY (id);
ALTER TABLE ONLY mastra_knowledge_records
    ADD CONSTRAINT mastra_knowledge_records_pkey PRIMARY KEY (id);
ALTER TABLE ONLY mastra_knowledge_semantic_outbox
    ADD CONSTRAINT mastra_knowledge_semantic_outbox_pkey PRIMARY KEY (id);
CREATE INDEX idx_knowledge_activity_latest ON mastra_knowledge_activity USING btree (id DESC);
CREATE INDEX idx_knowledge_mentions_record ON mastra_knowledge_mentions USING btree ("recordId", "sourceType", "sourceId");
CREATE UNIQUE INDEX idx_knowledge_nodes_identity ON mastra_knowledge_nodes USING btree (type, "scopeKey", "canonicalName");
CREATE INDEX idx_knowledge_nodes_scope ON mastra_knowledge_nodes USING btree ("scopeKey", type);
CREATE INDEX idx_knowledge_outbox_claim ON mastra_knowledge_semantic_outbox USING btree (status, "availableAt", "createdAt");
CREATE UNIQUE INDEX idx_knowledge_outbox_idempotency ON mastra_knowledge_semantic_outbox USING btree ("idempotencyKey");
CREATE INDEX idx_knowledge_records_node_latest ON mastra_knowledge_records USING btree (node, id DESC);
CREATE INDEX idx_knowledge_records_thread_latest ON mastra_knowledge_records USING btree ("sourceThreadId", id DESC);
