import { createKnowledgeLegacyUpgradeTests } from '@internal/storage-test-utils';
import { createPool } from 'mysql2/promise';
import { afterAll, vi } from 'vitest';

import { StoreOperationsMySQL } from '../operations';
import { KnowledgeMySQL } from '.';

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

/**
 * These cases drop every Knowledge table, so they get their own disposable database (created with the
 * test container's root account) instead of racing the other Knowledge test files on the shared one.
 */
const ROOT_CONFIG = {
  host: process.env.MYSQL_HOST || 'localhost',
  port: Number(process.env.MYSQL_PORT) || 3306,
  user: process.env.MYSQL_ROOT_USER || 'root',
  password: process.env.MYSQL_ROOT_PASSWORD || 'root',
};
const database = `knowledge_legacy_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
const admin = createPool({ ...ROOT_CONFIG, connectionLimit: 1 });
await admin.query(`CREATE DATABASE \`${database}\``);
const pool = createPool({ ...ROOT_CONFIG, database, connectionLimit: 10 });
const operations = new StoreOperationsMySQL({ pool, database });
const createStore = () => new KnowledgeMySQL({ pool, operations });
afterAll(async () => {
  await pool.end();
  await admin.query(`DROP DATABASE IF EXISTS \`${database}\``);
  await admin.end();
});

const knowledgeTables = async () => {
  const [rows] = await pool.query(
    "SELECT table_name AS name FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name LIKE 'mastra\\_knowledge\\_%'",
  );
  return (rows as Array<{ name: string }>).map(row => row.name);
};

createKnowledgeLegacyUpgradeTests({
  createStore,
  clear: async () => {
    for (const name of await knowledgeTables()) await pool.query(`DROP TABLE IF EXISTS \`${name}\``);
    await pool.query('DROP TABLE IF EXISTS `existing_domain`');
    await pool.query('CREATE TABLE `existing_domain` (id VARCHAR(64) PRIMARY KEY)');
    await pool.query("INSERT INTO `existing_domain` (id) VALUES ('preserved')");
  },
  // The shape @mastra/mysql 0.14.1 created, reduced to the columns and indexes that matter here.
  createPublishedLayout: async ({ rows }) => {
    await pool.query('CREATE TABLE `mastra_knowledge_nodes` (id VARCHAR(64) PRIMARY KEY, name VARCHAR(255))');
    await pool.query(
      'CREATE TABLE `mastra_knowledge_records` (id VARCHAR(64) PRIMARY KEY, node VARCHAR(64), INDEX idx_knowledge_records_node (node))',
    );
    await pool.query('CREATE TABLE `mastra_knowledge_semantic_outbox` (id VARCHAR(64) PRIMARY KEY)');
    await pool.query(
      'CREATE TABLE `mastra_knowledge_mentions` (sourceType VARCHAR(32), sourceId VARCHAR(64), recordId VARCHAR(64), PRIMARY KEY (recordId, sourceId))',
    );
    await pool.query(
      'CREATE TABLE `mastra_knowledge_activity` (id VARCHAR(64) PRIMARY KEY, action VARCHAR(32), recordType VARCHAR(32), recordId VARCHAR(64))',
    );
    await pool.query(
      'CREATE TABLE `mastra_knowledge_access_state` (id VARCHAR(64) PRIMARY KEY, epoch INT NOT NULL, schemaVersion INT NOT NULL)',
    );
    if (!rows) return;
    await pool.query("INSERT INTO `mastra_knowledge_access_state` VALUES ('knowledge', 1, 2)");
    await pool.query("INSERT INTO `mastra_knowledge_nodes` VALUES ('01LEGACY', 'Legacy')");
    await pool.query("INSERT INTO `mastra_knowledge_records` VALUES ('01REC', '01LEGACY')");
    await pool.query("INSERT INTO `mastra_knowledge_mentions` VALUES ('record', '01REC', '01REC')");
    await pool.query("INSERT INTO `mastra_knowledge_activity` VALUES ('01ACT', 'create', 'node', '01LEGACY')");
  },
  recreateLegacyTables: async () => {
    await pool.query(
      'CREATE TABLE IF NOT EXISTS `mastra_knowledge_nodes` (id VARCHAR(64) PRIMARY KEY, name VARCHAR(255))',
    );
    await pool.query('CREATE TABLE IF NOT EXISTS `mastra_knowledge_records` (id VARCHAR(64) PRIMARY KEY)');
    await pool.query('CREATE TABLE IF NOT EXISTS `mastra_knowledge_semantic_outbox` (id VARCHAR(64) PRIMARY KEY)');
    await pool.query("INSERT IGNORE INTO `mastra_knowledge_nodes` VALUES ('01OLD', 'Old')");
  },
  knowledgeTables,
  otherTableRows: async () => {
    const [rows] = await pool.query('SELECT COUNT(*) AS n FROM `existing_domain`');
    return Number((rows as Array<{ n: number }>)[0]!.n);
  },
});
