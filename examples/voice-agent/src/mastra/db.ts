/**
 * Single source of truth for the LibSQL database location.
 *
 * Memory, threads, traces, and the semantic-recall vector index all live in one
 * `voice-agent.db` file at the project root. The path is anchored to this module (not the
 * working directory) because the dev server (bundled into `.mastra/output`) and the voice
 * worker (running `src/mastra`) run with different working directories — a plain relative
 * path would give each process its own database. See `index.ts` for why a single SQLite file
 * is used across processes.
 */
export const voiceAgentDbUrl = new URL('../../voice-agent.db', import.meta.url).href;
