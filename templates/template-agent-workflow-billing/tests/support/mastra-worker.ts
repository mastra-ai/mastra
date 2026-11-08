import { runtimeFixture } from './mastra.js';
const [phase, serialized, executionId] = process.argv.slice(2);
const runtime = await runtimeFixture(JSON.parse(serialized));
try {
  const handle =
    phase === 'start'
      ? await runtime.billing.workflow('report').createRun({
          billing: runtime.billingContext,
          idempotencyKey: executionId ? `restart-create:${executionId}` : 'restart-create',
        })
      : await runtime.billing.workflow('report').getRun({ billing: runtime.billingContext, executionId });
  const result =
    phase === 'start'
      ? await handle.start({
          billing: runtime.billingContext,
          idempotencyKey: 'restart-start',
          inputData: { count: 0 },
        })
      : await handle.resume({
          billing: runtime.billingContext,
          idempotencyKey: 'restart-resume',
          step: 'approval',
          resumeData: { approved: true },
        });
  const duplicate =
    phase === 'resume'
      ? await handle.resume({
          billing: runtime.billingContext,
          idempotencyKey: 'restart-resume',
          step: 'approval',
          resumeData: { approved: true },
        })
      : undefined;
  process.send?.({
    executionId: handle.executionId,
    projection: result.kind === 'immediate' ? result.projection : result.result,
    billing: result.billing,
    duplicate,
  });
} catch (error) {
  process.send?.({ error: error instanceof Error ? error.stack : String(error) });
  process.exitCode = 1;
} finally {
  await runtime.close();
}
process.exit(process.exitCode ?? 0);
