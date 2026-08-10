/**
 * The Studio surface.
 *
 * Same agent, same scorers, same dataset as the headless exercises — two
 * differences, and both exist so the dashboard has something to show:
 *
 *   1. Storage is a real file (`file:./eval.db`) instead of a temp directory
 *      wiped on exit. Studio reads what previous runs wrote.
 *   2. Scorers are attached to the agent with a sampling rate, so ordinary
 *      chat traffic gets scored live — not just deliberate eval runs.
 *
 * Start it with:
 *   pnpm dev   → http://localhost:4111
 *
 * That one command is enough: `mastra dev` serves both the API and the Studio
 * UI on the same port. (There is also a separate `mastra studio` command that
 * serves only the UI on :3000 for pointing at a remote server — you do not
 * need it for local development, and its default auto-detect does not find a
 * local dev server reliably.)
 */
import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { MastraCompositeStore } from '@mastra/core/storage';
import { DuckDBStore } from '@mastra/duckdb';
import { LibSQLStore } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import { MastraStorageExporter, Observability, SensitiveDataFilter } from '@mastra/observability';
import { NIMBUS_KNOWLEDGE } from '@workshop/shared/data';
import { echoModel, hasApiKey, JUDGE_MODEL } from '@workshop/shared/models';
import { answerAccuracyScorer, answerRelevancy, supportRubricScorer, toxicity } from '@workshop/shared/scorers';
import { supportWorkflow } from '@workshop/shared/workflow';
import { DATABASE_URL, DUCKDB_PATH } from './db-path.ts';

/**
 * Storage is a composite, and the reason is worth understanding rather than
 * copying.
 *
 * LibSQL holds everything by default — agents, memory, datasets, experiments.
 * But Studio's Evaluation → Overview and Scorers views call the *generic*
 * `listScores()`, and LibSQL's scores domain only implements the scoped
 * variants (`listScoresByRunId`, `listScoresByScorerId`, …). The generic call
 * falls through to the abstract base, which throws:
 *
 *   500 — "This storage provider does not support listing scores"
 *
 * Only clickhouse, convex, duckdb, oracledb and pg implement it. DuckDB is the
 * cheapest of those to run locally (a file, no server), so it takes just the
 * observability domain while LibSQL keeps the rest.
 *
 * Both paths are absolute — see db-path.ts.
 */
const libsql = new LibSQLStore({
  id: 'workshop-studio',
  // A real file, deliberately. The headless surface uses a temp directory and
  // deletes it; here the whole point is that runs accumulate.
  url: DATABASE_URL,
});

const duckdb = new DuckDBStore({ id: 'workshop-observability', path: DUCKDB_PATH });

const storage = new MastraCompositeStore({
  id: 'workshop-composite',
  default: libsql,
  domains: {
    observability: await duckdb.getStore('observability'),
  },
});

/**
 * Fall back to the deterministic mock when no key is present, so the Studio
 * demo still runs end-to-end in a room where not everyone has credentials.
 * The LLM-judge scorer below is the part that genuinely requires one.
 */
const model = hasApiKey() ? JUDGE_MODEL : (echoModel(NIMBUS_KNOWLEDGE) as any);

export const supportAgent = new Agent({
  id: 'support-agent',
  name: 'Nimbus Support Agent',
  description: 'Answers Nimbus product questions from the documentation.',
  /**
   * The documentation is inlined into the instructions on purpose.
   *
   * The mock model answers from `NIMBUS_KNOWLEDGE` directly, but a real model
   * has no such thing — with instructions alone it correctly replies "I don't
   * have the Nimbus documentation", which is honest and scores terribly. The
   * live relevancy numbers were 0.0–0.65 until the facts were actually put in
   * front of it.
   *
   * A production agent would retrieve these passages instead of hard-coding
   * them. Inlining keeps the workshop to one moving part; the eval story is
   * identical either way.
   */
  instructions: `You are a support agent for Nimbus, a file-sync service.
Answer only from the Nimbus documentation below. Be concise — two sentences at
most. If the answer is not in the documentation, say so plainly rather than
guessing.

Nimbus documentation:
${Object.values(NIMBUS_KNOWLEDGE)
  .map(fact => `- ${fact}`)
  .join('\n')}`,
  model,
  memory: new Memory({
    storage,
    options: { lastMessages: 10, workingMemory: { enabled: false } },
  }),
  // ---------------------------------------------------------------------
  // Live scoring — evals watching real traffic instead of a fixed dataset.
  //
  // Which scorers go here is a real decision, not a copy-paste. Live traffic
  // has NO ground truth: nobody labelled the answer a user just received. So
  // only *reference-free* scorers belong here — ones that judge an answer on
  // its own terms.
  //
  // `answer-accuracy` is deliberately absent. It compares the output against
  // `groundTruth`, which is empty on live traffic, so it would score 0 on
  // every single request and paint a healthy agent as totally broken. It
  // stays where labels exist: datasets and experiments.
  //
  // `sampling.rate` is the cost dial: 1 scores everything (fine for a demo),
  // 0.05 scores one in twenty (what you want in production with a judge).
  // ---------------------------------------------------------------------
  scorers: hasApiKey()
    ? {
        // Reference-free: "does this answer the question that was asked?"
        answerRelevancy: {
          scorer: answerRelevancy as any,
          sampling: { type: 'ratio', rate: 1 },
        },
        // Reference-free safety check, cheap enough to run on everything.
        toxicity: {
          scorer: toxicity as any,
          sampling: { type: 'ratio', rate: 1 },
        },
      }
    : // Without a key there is no reference-free scorer available — every
      // code scorer in this workshop needs either groundTruth or expected
      // keywords. Better an empty live feed than a feed of meaningless zeros.
      {},
});

/**
 * Required for live scoring to be visible — not optional decoration.
 *
 * Scores from agent-attached scorers hang off trace spans. With no
 * `Observability` config there are no spans, so nothing is written and
 * Evaluation → Overview stays empty even though the scorers really ran.
 * The symptom is silent: no error anywhere, just zeros.
 *
 * Dataset and experiment scores are unaffected — those persist through the
 * dataset tables regardless. This only governs the live/sampled feed.
 *
 * Exported because spans are flushed in batches: a short-lived script (the
 * seed) exits before the flush and silently leaves no traces at all unless it
 * awaits `observability.shutdown()` first.
 */
export const observability = new Observability({
  configs: {
    default: {
      serviceName: 'evals-workshop',
      exporters: [new MastraStorageExporter()],
      spanOutputProcessors: [new SensitiveDataFilter()],
    },
  },
});

export const mastra = new Mastra({
  storage,
  agents: { 'support-agent': supportAgent },
  workflows: { 'support-workflow': supportWorkflow },
  observability,
  // Registered here so their scores persist and Studio can resolve them by id.
  scorers: {
    'answer-accuracy': answerAccuracyScorer as any,
    'support-rubric': supportRubricScorer as any,
    'answer-relevancy-scorer': answerRelevancy as any,
    'toxicity-scorer': toxicity as any,
  },
});
