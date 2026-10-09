-- Knowledge tables created by @mastra/mysql built from main ecdc523f008 (published W1 snapshots 20261008204450 onward share it),
-- captured with SHOW CREATE TABLE after KnowledgeMySQL.init(). Published v1 lacks the three *_scope/*_name indexes and adds mastra_knowledge_cursors.
CREATE TABLE `mastra_knowledge_activity` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `action` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `recordType` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `recordId` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `scope` json NOT NULL,
  `scopeKey` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `sourceThreadId` longtext COLLATE utf8mb4_unicode_ci,
  `createdAt` datetime(6) NOT NULL DEFAULT '1970-01-01 00:00:00.000000',
  PRIMARY KEY (`id`),
  KEY `idx_knowledge_activity_latest` (`id`(26) DESC),
  KEY `idx_knowledge_activity_scope` (`scopeKey`(255),`id`(26) DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `mastra_knowledge_mentions` (
  `sourceType` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `sourceId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `recordId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  PRIMARY KEY (`sourceType`,`sourceId`,`recordId`),
  KEY `idx_knowledge_mentions_record` (`recordId`,`sourceType`(32),`sourceId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `mastra_knowledge_nodes` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `type` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `canonicalName` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `kind` longtext COLLATE utf8mb4_unicode_ci,
  `content` longtext COLLATE utf8mb4_unicode_ci,
  `description` longtext COLLATE utf8mb4_unicode_ci,
  `scope` json NOT NULL,
  `scopeKey` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `version` int NOT NULL DEFAULT '0',
  `mergedInto` longtext COLLATE utf8mb4_unicode_ci,
  `createdAt` datetime(6) NOT NULL DEFAULT '1970-01-01 00:00:00.000000',
  `updatedAt` datetime(6) NOT NULL DEFAULT '1970-01-01 00:00:00.000000',
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_knowledge_nodes_identity` (`type`(32),`scopeKey`(255),`canonicalName`(255)),
  KEY `idx_knowledge_nodes_scope` (`scopeKey`(255),`type`(32)),
  KEY `idx_knowledge_nodes_name` (`type`(32),`canonicalName`(255))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `mastra_knowledge_records` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `node` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `text` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `scope` json NOT NULL,
  `scopeKey` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `sourceThreadId` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `capturedAt` datetime(6) NOT NULL DEFAULT '1970-01-01 00:00:00.000000',
  `when` datetime(6) DEFAULT NULL,
  `maxScope` longtext COLLATE utf8mb4_unicode_ci,
  `metadata` json DEFAULT NULL,
  `deletedAt` datetime(6) DEFAULT NULL,
  `deletedBy` longtext COLLATE utf8mb4_unicode_ci,
  PRIMARY KEY (`id`),
  KEY `idx_knowledge_records_node_latest` (`node`(191),`id`(26) DESC),
  KEY `idx_knowledge_records_thread_latest` (`sourceThreadId`(191),`id`(26) DESC),
  KEY `idx_knowledge_records_scope` (`scopeKey`(255),`id`(26))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `mastra_knowledge_semantic_outbox` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `idempotencyKey` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `documentId` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `documentType` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `operation` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `scope` json NOT NULL,
  `scopeKey` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `attempts` int NOT NULL DEFAULT '0',
  `availableAt` datetime(6) NOT NULL DEFAULT '1970-01-01 00:00:00.000000',
  `claimedAt` datetime(6) DEFAULT NULL,
  `claimedBy` longtext COLLATE utf8mb4_unicode_ci,
  `createdAt` datetime(6) NOT NULL DEFAULT '1970-01-01 00:00:00.000000',
  `completedAt` datetime(6) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_knowledge_outbox_idempotency` (`idempotencyKey`(255)),
  KEY `idx_knowledge_outbox_claim` (`status`(32),`availableAt`,`createdAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
