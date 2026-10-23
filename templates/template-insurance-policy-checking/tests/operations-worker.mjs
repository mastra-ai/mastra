import { mkdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { reportRuntime, reportContext } from './report-runtime.js';
import { evaluationCases } from './evaluation-cases.js';
import { fixtureFiles } from './reconciliation-fixtures.js';
import { runEvaluationCase } from '../scripts/evaluation-runtime.js';
import { operation } from '../src/mastra/runtime/operations.js';
const input = JSON.parse(process.argv[2]);
await mkdir(input.root, { recursive: true, mode: 0o700 });
if (input.mode === 'failure') {
  const result = await runEvaluationCase(evaluationCases[0], input.root, input.endpoint);
  if (result.state !== 'failed' || result.unauthorizedFinal) process.exitCode = 1;
} else if (input.mode === 'create') {
  const runtime = await reportRuntime(input.root, input.endpoint);
  try {
    const test = evaluationCases[0];
    const record = await runtime.caseService.capture(reportContext, await fixtureFiles(test.documents));
    const sources = await runtime.cases.sources(reportContext);
    const clarified = await runtime.caseService.clarify(reportContext, {
      caseId: record.id,
      expectedRevision: record.revision,
      identity: {
        policyNumber: 'CP-4021',
        insuredName: 'Elm Harbor Fabrication LLC',
        insuranceProduct: 'Commercial property',
      },
      intent: 'agreed_terms_checking',
      referenceId: sources[0].sourceId,
      targetId: sources[1].sourceId,
      roles: sources.map((s, i) => ({
        sourceId: s.sourceId,
        role: i === 0 ? 'proposal' : i === 1 ? 'issued_policy' : 'amendment',
      })),
      acceptedBaseline: {
        sourceId: sources[0].sourceId,
        statement: 'The broker records acceptance of this captured proposal.',
      },
    });
    await runtime.comparison.runner.compare(reportContext, {
      caseId: record.id,
      expectedRevision: clarified.revision,
      profileId: 'generic',
      asOf: '2026-05-01',
      retryAttemptId: null,
    });
  } finally {
    await runtime.close();
  }
} else {
  const runtime = await reportRuntime(input.root, input.endpoint);
  try {
    operation({ stage: 'startup', outcome: 'recovered', costMicros: null });
    const record = await runtime.cases.requireCase(reportContext);
    const publication = await runtime.reportRepository.get(reportContext);
    const request = {
      operationId: randomUUID(),
      caseId: record.id,
      reportId: publication.snapshot.id,
      version: publication.snapshot.version,
      snapshotHash: publication.hash,
      expectedRevision: record.revision,
      expectedState: 'AWAITING_REVIEW',
      action: input.mode === 'revise' ? 'revise' : 'approve',
      ...(input.mode === 'revise' ? { revision: { kind: 'presentation', note: 'SENTINEL_PRIVATE_REVIEW_PROSE' } } : {}),
    };
    await runtime.comparison.review(reportContext, request, {
      messageId: randomUUID(),
      text: '/review ' + JSON.stringify(request),
    });
    if (input.mode === 'revise') {
      const revised = await runtime.cases.requireCase(reportContext);
      await runtime.comparison.runner.compare(reportContext, {
        caseId: record.id,
        expectedRevision: revised.revision,
        profileId: 'generic',
        asOf: '2026-05-01',
        retryAttemptId: null,
      });
    }
  } finally {
    await runtime.close();
  }
}
