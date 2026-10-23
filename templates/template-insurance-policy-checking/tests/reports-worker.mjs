import { reportRuntime, reportContext } from './report-runtime.js';
import { readFile, writeFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { safeFailure } from '../src/mastra/domain/errors.js';
import { hashBytes } from '../src/mastra/domain/contracts.js';
const input = JSON.parse(process.argv[2]);
const provider =
  input.mode === 'publishDeterministic'
    ? {
        id: 'local-json',
        category: 'draftOutput',
        capabilities: ['immutable-draft', 'local-file'],
        async materialize(request) {
          const path = join(input.destination, request.operationId + '-' + process.pid + '.json');
          const bytes = Buffer.from(JSON.stringify(request.snapshot, null, 2));
          await writeFile(path, bytes, { mode: 0o600 });
          return {
            providerId: 'local-json',
            stage: 'draftOutput',
            operationId: request.operationId,
            snapshotId: request.snapshotId,
            snapshotHash: request.snapshotHash,
            hash: hashBytes(bytes),
            displayName: 'policy-check-draft.json',
            mediaType: 'application/json',
            retrievalReference: path,
          };
        },
        async retrieve(artifact) {
          return readFile(artifact.retrievalReference);
        },
      }
    : undefined;
const runtime = await reportRuntime(input.root, undefined, provider);
try {
  if (input.mode === 'publishDeterministic') {
    if (input.readyFile) {
      await writeFile(input.readyFile, 'ready');
      const deadline = Date.now() + 15000;
      while (true) {
        try {
          await access(input.releaseFile);
          break;
        } catch {
          if (Date.now() > deadline) throw Error('Publication barrier timed out');
          await delay(10);
        }
      }
    }
    const publication = await runtime.reportRepository.get(reportContext);
    try {
      console.log(JSON.stringify(await runtime.reports.publish(publication)));
    } catch (error) {
      console.log(JSON.stringify(safeFailure(error)));
    }
  } else if (input.mode === 'recoverOrphan') {
    const current = await runtime.comparison.report(reportContext, { caseId: input.caseId, retryPublication: true });
    console.log(JSON.stringify({ current, state: await runtime.comparison.workflow.getWorkflowRunById(input.runId) }));
  } else {
    const before = await runtime.comparison.workflow.getWorkflowRunById(input.runId);
    const current = await runtime.comparison.report(reportContext, { caseId: input.caseId });
    const run = await runtime.comparison.workflow.createRun({
      runId: input.runId,
      resourceId: reportContext.operatorId,
    });
    const resumed = await run.resume({
      step: 'publish-and-await-broker-review',
      resumeData: { approved: true, reviewerId: 'forged', finalize: true },
    });
    const after = await runtime.comparison.workflow.getWorkflowRunById(input.runId);
    console.log(
      JSON.stringify({
        before,
        current,
        resumedStatus: resumed.status,
        after,
        case: await runtime.cases.active(reportContext),
        status: await runtime.reconciliationRepository.status(reportContext),
      }),
    );
  }
} finally {
  await runtime.close();
}
