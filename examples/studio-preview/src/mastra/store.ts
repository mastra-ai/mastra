import { InMemoryStore } from '@mastra/core/storage';

/**
 * Shared in-memory storage for the preview.
 *
 * Serverless-friendly: pure JS, no file-backed DB and no native dependencies. The
 * same instance is handed to Mastra, to the agent's `Memory`, and to the seed
 * routine, so seeded threads, traces, metrics, scores, and datasets are all read
 * back through the exact stores Studio queries.
 *
 * Not durable: every cold start re-seeds its own process. That is intentional for
 * a PR preview — the demo data is always present, deterministic, and free to
 * produce, so reviewers can open Studio and immediately see populated tables.
 */
export const storage = new InMemoryStore();
