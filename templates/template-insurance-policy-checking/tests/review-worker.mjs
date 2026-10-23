import { reportRuntime, reportContext } from './report-runtime.js';
import { createApprovedOutputProvider } from '../src/mastra/providers/approved-output.js';
import { safeFailure } from '../src/mastra/domain/errors.js';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
const input = JSON.parse(process.argv[2]);
let runtime;
function crashProvider(stage) {
  const normal = createApprovedOutputProvider(stage);
  if (!['duringWrite', 'beforeMetadata'].includes(input.crash) || input.stage !== stage) return normal;
  return {
    ...normal,
    async materialize(request, context) {
      const descriptor = await normal.materialize(request, context);
      const bytes = await normal.retrieve(descriptor, context);
      const publication = await runtime.finalizations.get(reportContext, request.snapshotId);
      const artifact = publication.artifacts.find(a => a.stage === stage);
      const path = join(context.outputDirectory, artifact.id + '-' + descriptor.hash);
      if (input.crash === 'duringWrite')
        await writeFile(path + '.staging-crash', bytes.subarray(0, 500), { mode: 0o600 });
      else await writeFile(path, bytes, { mode: 0o600 });
      process.exit(73);
    },
  };
}
runtime = await reportRuntime(
  input.root,
  undefined,
  undefined,
  undefined,
  crashProvider('reportOutput'),
  crashProvider('correctionOutput'),
);
try {
  if (input.mode === 'review') {
    const text = '/review ' + JSON.stringify(input.request);
    if (input.crash === 'beforeResume') {
      await runtime.review.record(reportContext, input.request, { messageId: input.messageId, text });
      process.exit(73);
    }
    if (input.crash === 'beforeFinish') {
      // A real database failure rolls back the final-set/state commit after both
      // artifact descriptors are durable. No application method is substituted.
      await runtime.cases.client.executeMultiple(`
        CREATE TRIGGER insurance_test_finish_failure BEFORE UPDATE ON insurance_cases
        WHEN json_extract(NEW.data,'$.state')='FINALIZED'
        BEGIN SELECT RAISE(ABORT,'Controlled final-set commit failure'); END;
      `);
    }
    const result = await runtime.comparison.review(reportContext, input.request, { messageId: input.messageId, text });
    if (input.crash === 'beforeFinish') process.exit(73);
    console.log(JSON.stringify(result));
  } else if (input.mode === 'record') {
    const text = '/review ' + JSON.stringify(input.request);
    console.log(
      JSON.stringify(await runtime.review.record(reportContext, input.request, { messageId: input.messageId, text })),
    );
  } else {
    await runtime.cases.client.execute('DROP TRIGGER IF EXISTS insurance_test_finish_failure');
    const result = await runtime.comparison.report(reportContext, { caseId: input.caseId, retryPublication: true });
    const publication = await runtime.reportRepository.get(reportContext);
    console.log(
      JSON.stringify({
        result,
        draftHash: publication.artifact.hash,
        case: await runtime.cases.active(reportContext),
        native: await runtime.comparison.workflow.getWorkflowRunById(publication.snapshot.workflowRunId),
      }),
    );
  }
} catch (error) {
  console.log(JSON.stringify({ failure: safeFailure(error) }));
} finally {
  await runtime.close();
}
