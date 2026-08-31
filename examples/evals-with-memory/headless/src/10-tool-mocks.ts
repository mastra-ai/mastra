/**
 * Exercise 10 — Tool mocks, and turning a real run into a regression test.
 *
 * Every exercise so far has evaluated an agent that only talks. Real agents
 * call things, and the moment they do, your eval inherits every dependency
 * they touch. A dataset row that was passing yesterday fails today because a
 * row in the accounts table changed — the agent is fine, the test is not.
 *
 * Mastra's answer is item-level tool mocks: declare what a tool should return
 * for this item and the agent is served that value instead of executing the
 * real thing. Five parts here, in the order the problem actually shows up:
 *
 *   a) the problem  — an unmocked eval moves when its dependency moves
 *   b) the fix      — mocks pin it
 *   c) proof        — `unmockedToolPolicy: 'deny'` proves nothing leaked
 *   d) the guard    — a mock that stops matching fails loudly, not silently
 *   e) the payoff   — record a real trace, replay it forever
 *
 * Tool mocks apply to `targetType: 'agent'` only. They are ignored for `task`,
 * `workflow`, and `scorer` targets, which is worth knowing before you spend an
 * afternoon wondering why yours do nothing.
 *
 * No API key required.
 */
import { runExperiment } from '@mastra/core/datasets';
import { collectToolMocks, extractTrajectoryFromTrace } from '@mastra/core/evals';
import { MastraCompositeStore } from '@mastra/core/storage';
import { DuckDBStore } from '@mastra/duckdb';
import { MastraStorageExporter, Observability } from '@mastra/observability';
import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { LibSQLStore } from '@mastra/libsql';
import { toolCallingModel } from '@workshop/shared/models';
import { answerAccuracyScorer, extractText } from '@workshop/shared/scorers';
import { liveToolCallCount, lookupAccount, resetAccounts, setAccountUsage } from '@workshop/shared/tools';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const QUESTION = 'How much storage has acct-42 used?';
/** What the tool returns before anyone touches production. */
const SNAPSHOT = { plan: 'Free', storageUsedGb: 11.2, storageLimitGb: 15 };

async function main() {
  resetAccounts();
  const dir = mkdtempSync(join(tmpdir(), 'evals-with-memory-'));
  const cleanup = () => rmSync(dir, { recursive: true, force: true });

  // Traces are needed for part (e). DuckDB takes the observability domain
  // because LibSQL cannot store spans — see the README gotcha.
  const libsql = new LibSQLStore({ id: 'tool-mocks', url: `file:${join(dir, 'eval.db')}` });
  const duckdb = new DuckDBStore({ id: 'tool-mocks-obs', path: join(dir, 'obs.duckdb') });
  const storage = new MastraCompositeStore({
    id: 'tool-mocks-composite',
    default: libsql,
    domains: { observability: await duckdb.getStore('observability') },
  });

  const agent = new Agent({
    id: 'billing-agent',
    name: 'Nimbus Billing Agent',
    description: 'Answers questions about a customer account by looking it up.',
    instructions: 'Call lookupAccount, then answer in one sentence using the numbers it returns.',
    model: toolCallingModel('lookupAccount', 'acct-42') as any,
    tools: { lookupAccount },
  });

  const observability = new Observability({
    configs: { default: { serviceName: 'evals-with-memory', exporters: [new MastraStorageExporter()] } },
  });

  const mastra = new Mastra({
    storage,
    agents: { 'billing-agent': agent },
    scorers: { 'answer-accuracy': answerAccuracyScorer as any },
    observability,
  });

  const run = (data: any[], extra: Record<string, unknown> = {}) =>
    runExperiment(mastra, {
      data,
      targetType: 'agent',
      targetId: 'billing-agent',
      scorers: [answerAccuracyScorer],
      ...extra,
    });

  const report = (summary: any, label: string) => {
    const item = summary.results[0];
    const mocks = item.toolMockReport;
    // `output` is MastraDBMessage[], not a string — see exercise 1's extractText.
    const answer = item.error ? item.error.message : extractText(item.output);
    console.log(`  ${label}`);
    console.log(`    answer      : ${answer.slice(0, 64)}`);
    console.log(`    score       : ${item.scores[0]?.score ?? '—'}`);
    if (mocks) {
      console.log(`    served      : ${mocks.served.length}   liveCalls: ${mocks.liveCalls.length}`);
      if (mocks.failure) console.log(`    failure     : ${mocks.failure.code} on ${mocks.failure.toolName}`);
      if (mocks.unconsumed.length) console.log(`    unconsumed  : ${mocks.unconsumed.length}`);
    } else {
      // No mocks and no deny policy means no matcher was installed at all, so
      // there is no receipt to print. That absence is itself the finding.
      console.log(`    toolMockReport: none (nothing was intercepted)`);
    }
    return item;
  };

  try {
    // -------------------------------------------------------------------
    // a) The problem.
    //
    // Same item, same agent, run twice — with a change to the *account* in
    // between. Nothing about the agent moved. The eval moves anyway, because
    // the tool reads state that lives outside the test.
    // -------------------------------------------------------------------
    console.log('── a) unmocked: the dependency moves, the eval moves ──');
    const unmockedItem = [{ input: QUESTION, groundTruth: '11.2 GB' }];

    const before = liveToolCallCount;
    report(await run(unmockedItem), 'before (production says 11.2 GB used)');

    setAccountUsage('acct-42', 13.9); // somebody uploaded some files
    report(await run(unmockedItem), 'after  (production says 13.9 GB used)');
    console.log(`\n    real tool executions: ${liveToolCallCount - before}`);
    console.log(
      '    A green suite yesterday and a red one today, with an identical\n' +
        '    agent. Note there is no toolMockReport on these runs at all — you\n' +
        '    get a receipt only once you opt into interception, so an unmocked\n' +
        '    suite cannot even tell you what it touched.',
    );

    // -------------------------------------------------------------------
    // b) The fix.
    //
    // `toolMocks` pins the tool's answer to this item. Production is still
    // sitting at 13.9 — the mock does not care.
    //
    // `args` are matched by deep equality (`matchArgs: 'strict'`, the
    // default). Use `'ignore'` to match on tool name alone, which you want
    // for arguments an LLM authors freely.
    // -------------------------------------------------------------------
    console.log('\n── b) mocked: production still says 13.9, the eval does not care ──');
    const mockedItem = [
      {
        input: QUESTION,
        groundTruth: '11.2 GB',
        toolMocks: [{ toolName: 'lookupAccount', args: { accountId: 'acct-42' }, output: SNAPSHOT }],
      },
    ];
    report(await run(mockedItem), 'mocked');
    console.log(`\n    served: 1, liveCalls: 0 — the real tool never ran.`);

    // -------------------------------------------------------------------
    // c) Proof, not hope.
    //
    // `served: 1, liveCalls: 0` on one item is good. On a large suite you
    // want the run to *fail* if anything touches the network, rather than
    // reading counts. `unmockedToolPolicy: 'deny'` does that: any tool call
    // not covered by a mock fails the item with TOOL_MOCK_NOT_DECLARED.
    // -------------------------------------------------------------------
    console.log("\n── c) unmockedToolPolicy: 'deny' — an undeclared call fails the item ──");
    report(await run(unmockedItem, { unmockedToolPolicy: 'deny' }), 'no mocks declared, deny policy');
    console.log('\n    This is the setting that makes "our evals are hermetic" checkable.');

    // -------------------------------------------------------------------
    // d) The guard.
    //
    // The danger with mocks is drift: the agent changes what it sends, the
    // mock keeps answering the old call, and the suite keeps passing while
    // testing something that no longer happens. Strict arg matching prevents
    // it — a call the mock does not match is an error, not a fallthrough.
    // -------------------------------------------------------------------
    console.log('\n── d) a mock that no longer matches fails loudly ──');
    const staleMock = [
      {
        input: QUESTION,
        groundTruth: '11.2 GB',
        // The agent asks about acct-42; this mock is still answering acct-1.
        toolMocks: [{ toolName: 'lookupAccount', args: { accountId: 'acct-1' }, output: SNAPSHOT }],
      },
    ];
    report(await run(staleMock), 'stale mock (wrong accountId)');
    console.log(
      '\n    TOOL_MOCK_MISMATCH. Compare with a mocking library that would have\n' +
        '    silently returned undefined and let the item "pass".',
    );

    // -------------------------------------------------------------------
    // e) The payoff: record once, replay forever.
    //
    // Hand-writing mocks is fine for one tool. For an agent that makes six
    // calls in a specific order it is miserable and wrong by the second edit.
    // `collectToolMocks` reads a real trace and writes them for you.
    //
    // This is the production→test loop: something interesting happens in
    // prod, you grab its trace, and it becomes a deterministic regression
    // test with the real arguments and real responses already filled in.
    // -------------------------------------------------------------------
    console.log('\n── e) record a real run, replay it as a test ──');
    resetAccounts();
    const live: any = await mastra.getAgent('billing-agent').generate(QUESTION);

    // Spans are exported in batches. A short-lived script exits before the
    // flush, so without this you get zero traces and no error — see README.
    await observability.shutdown();

    const observabilityStore: any = await storage.getStore('observability');
    const trace = await observabilityStore.getTrace({ traceId: live.traceId });
    const trajectory = extractTrajectoryFromTrace(trace?.spans ?? []);
    const recorded = collectToolMocks(trajectory.steps);

    console.log(`    traceId  : ${live.traceId}`);
    console.log(`    recorded : ${JSON.stringify(recorded)}`);

    setAccountUsage('acct-42', 99.9); // production drifts as far as you like
    const replay = await run([{ input: QUESTION, groundTruth: '11.2 GB', toolMocks: recorded }], {
      unmockedToolPolicy: 'deny',
    });
    report(replay, 'replayed against the recorded mocks');

    console.log(
      `\n  Real tool executions this whole exercise: ${liveToolCallCount}\n` +
        '  — and none of them were in the replay. The recorded run is now a\n' +
        '  fixture: same inputs, same tool responses, same answer, forever.',
    );
  } finally {
    cleanup();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
