-- Knowledge tables created by the interim canonical-model release (main 38643beb41a, @mastra/core 1.76.0-alpha.3),
-- captured with pg_dump --schema-only from KnowledgePG.init() and unqualified so a test can load it into any schema.
CREATE TABLE mastra_knowledge_access_state (
    id text NOT NULL,
    epoch integer NOT NULL,
    "schemaVersion" integer NOT NULL
);
CREATE TABLE mastra_knowledge_activity (
    id text NOT NULL,
    action text NOT NULL,
    "targetType" text,
    "targetId" text,
    "contextScopeId" text,
    "importRunId" text,
    details jsonb,
    "createdAt" timestamp without time zone NOT NULL,
    "recordType" text,
    "recordId" text,
    scope jsonb,
    "scopeKey" text,
    "sourceThreadId" text,
    "createdAtZ" timestamp with time zone DEFAULT now()
);
CREATE TABLE mastra_knowledge_import_runs (
    id text NOT NULL,
    "importerId" text NOT NULL,
    binding text NOT NULL,
    "importKind" text NOT NULL,
    "triggerKind" text NOT NULL,
    status text NOT NULL,
    error text,
    "transcriptThreadId" text,
    "traceId" text,
    "queuedAt" timestamp without time zone NOT NULL,
    "startedAt" timestamp without time zone,
    "completedAt" timestamp without time zone,
    "queuedAtZ" timestamp with time zone DEFAULT now(),
    "startedAtZ" timestamp with time zone DEFAULT now(),
    "completedAtZ" timestamp with time zone DEFAULT now()
);
CREATE TABLE mastra_knowledge_import_state (
    "importerId" text NOT NULL,
    binding text NOT NULL,
    key text NOT NULL,
    value text NOT NULL
);
CREATE TABLE mastra_knowledge_mentions (
    "recordId" text NOT NULL,
    "targetNodeId" text,
    "sourceType" text,
    "sourceId" text NOT NULL
);
CREATE TABLE mastra_knowledge_node_addresses (
    source text NOT NULL,
    address text NOT NULL,
    "nodeId" text NOT NULL
);
CREATE TABLE mastra_knowledge_node_scopes (
    "nodeId" text NOT NULL,
    "scopeNodeId" text NOT NULL,
    "addedAt" timestamp without time zone NOT NULL,
    "addedAtZ" timestamp with time zone DEFAULT now()
);
CREATE TABLE mastra_knowledge_nodes (
    id text NOT NULL,
    name text NOT NULL,
    kind text,
    "isScope" boolean NOT NULL,
    metadata jsonb,
    version integer NOT NULL,
    "createdAt" timestamp without time zone NOT NULL,
    "updatedAt" timestamp without time zone NOT NULL,
    "deletedAt" timestamp without time zone,
    "deletedBy" text,
    type text,
    "canonicalName" text,
    content text,
    description text,
    scope jsonb,
    "scopeKey" text,
    "mergedInto" text,
    "createdAtZ" timestamp with time zone DEFAULT now(),
    "updatedAtZ" timestamp with time zone DEFAULT now(),
    "deletedAtZ" timestamp with time zone DEFAULT now()
);
CREATE TABLE mastra_knowledge_proposals (
    id text NOT NULL,
    "targetType" text NOT NULL,
    "targetId" text NOT NULL,
    action text NOT NULL,
    changes jsonb NOT NULL,
    reason text,
    "proposerContextScopeId" text NOT NULL,
    "expectedVersion" integer NOT NULL,
    status text NOT NULL,
    "reviewerContextScopeId" text,
    "reviewedAt" timestamp without time zone,
    "createdAt" timestamp without time zone NOT NULL,
    "reviewedAtZ" timestamp with time zone DEFAULT now(),
    "createdAtZ" timestamp with time zone DEFAULT now()
);
CREATE TABLE mastra_knowledge_record_scopes (
    "recordId" text NOT NULL,
    "scopeNodeId" text NOT NULL,
    "addedAt" timestamp without time zone NOT NULL,
    "addedAtZ" timestamp with time zone DEFAULT now()
);
CREATE TABLE mastra_knowledge_records (
    id text NOT NULL,
    node text NOT NULL,
    text text NOT NULL,
    metadata jsonb,
    version integer NOT NULL,
    "capturedAt" timestamp without time zone NOT NULL,
    "updatedAt" timestamp without time zone NOT NULL,
    "deletedAt" timestamp without time zone,
    "deletedBy" text,
    scope jsonb,
    "scopeKey" text,
    "sourceThreadId" text,
    "when" timestamp without time zone,
    "capturedAtZ" timestamp with time zone DEFAULT now(),
    "updatedAtZ" timestamp with time zone DEFAULT now(),
    "deletedAtZ" timestamp with time zone DEFAULT now(),
    "whenZ" timestamp with time zone DEFAULT now()
);
CREATE TABLE mastra_knowledge_scope_addresses (
    address text NOT NULL,
    "scopeNodeId" text NOT NULL
);
CREATE TABLE mastra_knowledge_scope_grants (
    "scopeNodeId" text NOT NULL,
    "scopeRefId" text NOT NULL,
    role text NOT NULL,
    "canSuggest" boolean
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
ALTER TABLE ONLY mastra_knowledge_access_state
    ADD CONSTRAINT mastra_knowledge_access_state_pkey PRIMARY KEY (id);
ALTER TABLE ONLY mastra_knowledge_activity
    ADD CONSTRAINT mastra_knowledge_activity_pkey PRIMARY KEY (id);
ALTER TABLE ONLY mastra_knowledge_import_runs
    ADD CONSTRAINT mastra_knowledge_import_runs_pkey PRIMARY KEY (id);
ALTER TABLE ONLY mastra_knowledge_import_state
    ADD CONSTRAINT mastra_knowledge_import_state_pkey PRIMARY KEY ("importerId", binding, key);
ALTER TABLE ONLY mastra_knowledge_mentions
    ADD CONSTRAINT mastra_knowledge_mentions_pkey PRIMARY KEY ("recordId", "sourceId");
ALTER TABLE ONLY mastra_knowledge_node_addresses
    ADD CONSTRAINT mastra_knowledge_node_addresses_pkey PRIMARY KEY (source, address);
ALTER TABLE ONLY mastra_knowledge_node_scopes
    ADD CONSTRAINT mastra_knowledge_node_scopes_pkey PRIMARY KEY ("nodeId", "scopeNodeId");
ALTER TABLE ONLY mastra_knowledge_nodes
    ADD CONSTRAINT mastra_knowledge_nodes_pkey PRIMARY KEY (id);
ALTER TABLE ONLY mastra_knowledge_proposals
    ADD CONSTRAINT mastra_knowledge_proposals_pkey PRIMARY KEY (id);
ALTER TABLE ONLY mastra_knowledge_record_scopes
    ADD CONSTRAINT mastra_knowledge_record_scopes_pkey PRIMARY KEY ("recordId", "scopeNodeId");
ALTER TABLE ONLY mastra_knowledge_records
    ADD CONSTRAINT mastra_knowledge_records_pkey PRIMARY KEY (id);
ALTER TABLE ONLY mastra_knowledge_scope_addresses
    ADD CONSTRAINT mastra_knowledge_scope_addresses_pkey PRIMARY KEY (address);
ALTER TABLE ONLY mastra_knowledge_scope_grants
    ADD CONSTRAINT mastra_knowledge_scope_grants_pkey PRIMARY KEY ("scopeNodeId", "scopeRefId");
ALTER TABLE ONLY mastra_knowledge_semantic_outbox
    ADD CONSTRAINT mastra_knowledge_semantic_outbox_pkey PRIMARY KEY (id);
CREATE INDEX idx_knowledge_activity_import_run ON mastra_knowledge_activity USING btree ("importRunId", id DESC);
CREATE INDEX idx_knowledge_activity_latest ON mastra_knowledge_activity USING btree (id DESC);
CREATE INDEX idx_knowledge_activity_scope ON mastra_knowledge_activity USING btree ("scopeKey", id DESC);
CREATE INDEX idx_knowledge_import_runs_lookup ON mastra_knowledge_import_runs USING btree ("importerId", binding, "queuedAt" DESC);
CREATE INDEX idx_knowledge_mentions_record ON mastra_knowledge_mentions USING btree ("recordId", "sourceType", "sourceId");
CREATE INDEX idx_knowledge_node_addresses_node ON mastra_knowledge_node_addresses USING btree ("nodeId");
CREATE INDEX idx_knowledge_node_scopes_scope ON mastra_knowledge_node_scopes USING btree ("scopeNodeId", "nodeId");
CREATE UNIQUE INDEX idx_knowledge_nodes_identity ON mastra_knowledge_nodes USING btree (type, "scopeKey", "canonicalName");
CREATE INDEX idx_knowledge_nodes_name ON mastra_knowledge_nodes USING btree (type, "canonicalName");
CREATE INDEX idx_knowledge_nodes_scope ON mastra_knowledge_nodes USING btree ("scopeKey", type);
CREATE INDEX idx_knowledge_outbox_claim ON mastra_knowledge_semantic_outbox USING btree (status, "availableAt", "createdAt");
CREATE UNIQUE INDEX idx_knowledge_outbox_idempotency ON mastra_knowledge_semantic_outbox USING btree ("idempotencyKey");
CREATE INDEX idx_knowledge_record_scopes_scope ON mastra_knowledge_record_scopes USING btree ("scopeNodeId", "recordId");
CREATE INDEX idx_knowledge_records_node_latest ON mastra_knowledge_records USING btree (node, id DESC);
CREATE INDEX idx_knowledge_records_scope ON mastra_knowledge_records USING btree ("scopeKey", id);
CREATE INDEX idx_knowledge_records_thread_latest ON mastra_knowledge_records USING btree ("sourceThreadId", id DESC);
CREATE INDEX idx_knowledge_scope_grants_ref ON mastra_knowledge_scope_grants USING btree ("scopeRefId", "scopeNodeId");
