import { parseArgs } from 'node:util';
import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import { openProcessingStore } from '../src/mastra/persistence/processing.ts';
import { vendorRiskDrafts } from '../src/mastra/workflows/vendor-risk-drafts.ts';
import { executionPolicySchema, defaultExecutionPolicy } from '../src/mastra/contracts/execution-policy.ts';

let runId: string | undefined;
try {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      'run-id': { type: 'string' },
      root: { type: 'string' },
      manifest: { type: 'string' },
      policy: { type: 'string' },
    },
  });
  runId = z
    .string()
    .regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,100}$/)
    .parse(values['run-id']);
  if (positionals[0] === 'status') {
    const store = await openProcessingStore();
    try {
      const status = await store.status(runId);
      if (!status) throw new Error('No persisted draft run.');
      // Supporting text belongs in the restricted local record, not general CLI telemetry.
      console.log(
        JSON.stringify(
          {
            runId,
            state: status.run.state,
            stopReason: status.run.stopReason,
            policy: status.run.policy,
            results: status.results.map(r => ({
              questionId: r.questionId,
              order: r.order,
              status: r.status,
              reasons: r.reasons,
              value: r.draft?.value,
              attempts: r.attempts,
            })),
            physicalCalls: status.usage.length,
            uncertainCalls: status.usage.filter(u => u.status !== 'observed').length,
            estimatedUsd: status.usage.reduce((sum, u) => sum + u.estimatedUsd, 0),
          },
          null,
          2,
        ),
      );
    } finally {
      store.close();
    }
  } else if (positionals[0] === 'start') {
    const policy = values.policy
      ? executionPolicySchema.parse(JSON.parse(await readFile(values.policy, 'utf8')))
      : defaultExecutionPolicy;
    const run = await vendorRiskDrafts.createRun();
    const result = await run.start({
      inputData: {
        runId,
        evidenceRoot: z.string().min(1).parse(values.root),
        manifestPath: z.string().min(1).parse(values.manifest),
        policy,
      },
    });
    const store = await openProcessingStore();
    let processing;
    try {
      processing = await store.status(runId);
    } finally {
      store.close();
    }
    console.log(
      JSON.stringify({
        runId,
        workflowStatus: result.status,
        state: processing?.run.state ?? null,
        stopReason: processing?.run.stopReason ?? null,
        next: `npm run draft -- status --run-id ${runId}`,
      }),
    );
    if (result.status !== 'success' || processing?.run.state !== 'awaiting_review') process.exitCode = 1;
  } else throw new Error('Use start or status.');
} catch {
  console.error(JSON.stringify({ runId, code: 'DRAFT_OPERATION_FAILED' }));
  process.exitCode = 1;
}
