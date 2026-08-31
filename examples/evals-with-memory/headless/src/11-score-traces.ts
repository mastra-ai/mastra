/**
 * Exercise 11 — Scoring traffic that already happened.
 *
 * Every eval so far has been prospective: assemble inputs, run the agent, score
 * what comes back. That misses the largest and most honest dataset you own —
 * the requests real users already made.
 *
 * A trace records the input and the output. Everything a scorer needs is
 * already sitting in storage, so there is no reason to re-run the agent to
 * grade it. `scoreTraces` does exactly that: point a scorer at trace ids and it
 * scores them after the fact.
 *
 * What this unlocks is worth stating plainly, because it inverts the usual
 * order of operations: you can write a scorer *today* and find out how the
 * agent has been doing on it *since last month*. No re-running, no replaying,
 * no cost beyond the scorer itself. When someone reports a bug on Friday, you
 * can measure how often it has been happening since March.
 *
 * No API key required (uses a code scorer; an LLM judge is used if a key is
 * present, since that is the realistic production choice).
 */
import { Mastra } from '@mastra/core/mastra';
import { scoreTraceBatch } from '@mastra/core/evals/scoreTraces';
import { MastraCompositeStore } from '@mastra/core/storage';
import { DuckDBStore } from '@mastra/duckdb';
import { LibSQLStore } from '@mastra/libsql';
import { MastraStorageExporter, Observability } from '@mastra/observability';
import { Agent } from '@mastra/core/agent';
import { NIMBUS_KNOWLEDGE, SUPPORT_QA } from '@workshop/shared/data';
import { echoModel, hasApiKey } from '@workshop/shared/models';
import { answerRelevancy, completeness } from '@workshop/shared/scorers';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

async function main() {
  const dir = mkdtempSync(join(tmpdir(), 'evals-with-memory-'));
  const cleanup = () => rmSync(dir, { recursive: true, force: true });

  const libsql = new LibSQLStore({ id: 'score-traces', url: `file:${join(dir, 'eval.db')}` });
  const duckdb = new DuckDBStore({ id: 'score-traces-obs', path: join(dir, 'obs.duckdb') });
  const storage = new MastraCompositeStore({
    id: 'score-traces-composite',
    default: libsql,
    domains: { observability: await duckdb.getStore('observability') },
  });

  const agent = new Agent({
    id: 'support-agent',
    name: 'Nimbus Support Agent',
    description: 'Answers Nimbus product questions.',
    instructions: 'You are a Nimbus support agent. Answer concisely.',
    model: echoModel(NIMBUS_KNOWLEDGE) as any,
  });

  const observability = new Observability({
    configs: { default: { serviceName: 'evals-with-memory', exporters: [new MastraStorageExporter()] } },
  });

  // ---------------------------------------------------------------------
  // The scorer has to be registered here, under the id you will pass to
  // scoreTraces. It is looked up by id at scoring time — `getScorerById` —
  // so an unregistered scorer fails with MASTRA_SCORER_NOT_FOUND_FOR_TRACE_
  // SCORING, logged rather than thrown, and you get silence and no scores.
  //
  // Choice of scorer matters as much as in live scoring (exercise: Studio):
  // traces carry no groundTruth, so only reference-free scorers make sense.
  // ---------------------------------------------------------------------
  // Use the scorer's OWN id, not a nickname. `getScorerById` resolves against
  // `scorer.id`, and the prebuilt scorers name themselves with a `-scorer`
  // suffix — `completeness-scorer`, `answer-relevancy-scorer`. Registering one
  // under a tidier key and then asking for that key fails with
  // MASTRA_GET_SCORER_BY_ID_NOT_FOUND, which reads like the scorer is missing
  // when it is sitting right there under a different name.
  const chosen = hasApiKey() ? answerRelevancy : completeness;
  const scorerId = (chosen as any).id;

  const mastra = new Mastra({
    storage,
    agents: { 'support-agent': agent },
    observability,
    scorers: {
      [(completeness as any).id]: completeness as any,
      [(answerRelevancy as any).id]: answerRelevancy as any,
    },
  });

  try {
    // -------------------------------------------------------------------
    // Generate some traffic. Note there is no scorer attached to the agent
    // and no eval running here — this is just an agent serving requests, the
    // way it would in production on a day nobody was thinking about evals.
    // -------------------------------------------------------------------
    console.log('── serving traffic (no scoring configured) ──');
    const live = mastra.getAgent('support-agent');
    for (const item of SUPPORT_QA) {
      const result = await live.generate(item.input);
      console.log(`  ${item.input.slice(0, 44).padEnd(46)} → ${result.text.slice(0, 30)}…`);
    }

    // Spans are exported in batches; a short-lived script exits before the
    // flush. Without this you get zero traces, no error, and an exercise that
    // silently scores nothing.
    await observability.shutdown();

    // -------------------------------------------------------------------
    // Later — a different day, a different process. Find the traffic.
    // -------------------------------------------------------------------
    const observabilityStore: any = await storage.getStore('observability');
    const listed = await observabilityStore.listTraces({ pagination: { page: 0, perPage: 50 } });
    const traceIds: string[] = [...new Set<string>((listed.spans ?? []).map((s: any) => s.traceId))];
    console.log(`\n── found ${traceIds.length} traces in storage ──`);

    // -------------------------------------------------------------------
    // Score them. The agent is not involved — nothing is re-run. The scorer
    // reads each trace's recorded input and output straight from storage.
    // -------------------------------------------------------------------
    // -------------------------------------------------------------------
    // Two entry points, and the difference matters:
    //
    //   scoreTraces({ scorerId, targets, mastra })
    //     The fire-and-forget one. It drives an internal workflow and
    //     swallows failures into the logger. Convenient from a server — but
    //     that workflow is registered by the CLI bundler, so under
    //     `mastra dev` it works and in a plain script it throws
    //     "Workflow with id __batch-scoring-traces not found". Register it
    //     yourself with mastra.__registerInternalWorkflow(scoreTracesWorkflow)
    //     if you want it here.
    //
    //   scoreTraceBatch({ storage, scorer, targets })
    //     Direct, awaited, and it returns the scores. Better for scripts and
    //     CI precisely because a failure is a value you can see rather than
    //     a log line you have to go looking for.
    // -------------------------------------------------------------------
    console.log(`\n── scoring them with "${scorerId}" after the fact ──`);
    const batch = await scoreTraceBatch({
      storage: storage as any,
      scorer: mastra.getScorerById(scorerId) as any,
      targets: traceIds.map(traceId => ({ traceId })),
      // A batch handle stamped on every score, so one scoring pass over a
      // month of history stays identifiable later.
      batchId: 'workshop-backfill',
      concurrency: 4,
    });

    console.log(`  scored: ${batch.scoredCount}   failed: ${batch.failedCount}`);
    for (const entry of batch.results) {
      if (!entry.ok) {
        console.log(`    FAILED  ${entry.traceId?.slice(0, 12) ?? ''}… ${String((entry as any).error).slice(0, 40)}`);
        continue;
      }
      const question = extractQuestion(entry.score);
      const value = entry.score.score;
      console.log(`    ${(value == null ? '—' : value.toFixed(3)).padEnd(6)} ${question.slice(0, 52)}`);
    }

    const ok = batch.results.filter((r: any) => r.ok);
    if (ok.length) {
      const mean = ok.reduce((a: number, r: any) => a + (r.score.score ?? 0), 0) / ok.length;
      console.log(`\n  mean ${mean.toFixed(3)} over traffic that was never evaluated at request time.`);
    }

    // The scores are persisted like any other, so everything downstream —
    // the Studio dashboard, listScoresByScorerId — sees them too.
    const scoresStore: any = await storage.getStore('scores');
    const saved = await scoresStore.listScoresByScorerId({ scorerId, pagination: { page: 0, perPage: 50 } });
    console.log(`  persisted and readable back: ${saved.scores.length}`);

    console.log(
      '\n  The point is the order of events: the traffic happened first, the\n' +
        '  scorer came second. Nothing was re-run, and nothing had to be\n' +
        '  instrumented in advance beyond keeping traces. A scorer you write\n' +
        '  tomorrow can grade everything you served last month.',
    );
  } finally {
    cleanup();
  }
}

/** Best-effort pull of the original question out of a saved score row. */
function extractQuestion(score: any): string {
  const messages = score?.input?.inputMessages;
  const first = Array.isArray(messages) ? messages[0] : undefined;
  const content = first?.content;
  if (typeof content === 'string') return content;
  if (typeof content?.content === 'string') return content.content;
  return score?.traceId ?? '';
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
