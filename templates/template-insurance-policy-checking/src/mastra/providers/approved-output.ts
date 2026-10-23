import { open, rename, unlink, realpath } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { resolve, sep } from 'node:path';
import { hashBytes, type OutputProvider } from '../domain/contracts.js';
import { reportOutputRequestSchema, correctionOutputRequestSchema } from '../domain/output-contracts.js';
import { actionableFindings } from '../domain/reviews.js';
import { termValue } from '../domain/report-presentation.js';
import { IntakeError } from '../domain/errors.js';
import { renderDraftPdf } from './draft-pdf.js';

const markdown = (text: string) => text.replace(/[\\`*_{}\[\]()#+!|<>]/g, '\\$&');
export function createApprovedOutputProvider<C extends 'reportOutput' | 'correctionOutput'>(
  stage: C,
): OutputProvider<C> {
  const id = stage === 'reportOutput' ? 'local-pdf-final' : 'local-markdown-correction';
  const extension = stage === 'reportOutput' ? '.pdf' : '.md';
  return {
    id,
    category: stage,
    capabilities: ['approved-output', 'local-file'],
    async materialize(input, context) {
      const request = (stage === 'reportOutput' ? reportOutputRequestSchema : correctionOutputRequestSchema).parse(
        input,
      );
      const r = request.snapshot;
      const findings = actionableFindings(r, request.approval);
      if (stage === 'correctionOutput' && !findings.length)
        throw new IntakeError(
          'CORRECTION_NOT_APPLICABLE',
          'No explicitly confirmed actionable discrepancies need a correction draft.',
          'Retrieve the approved final report.',
        );
      const lines = [
        '# Proposed correction request — not sent',
        '',
        'To: [Insurer or responsible team]',
        `Policy: ${markdown(r.identity.policyNumber ?? 'Not available')}`,
        'Subject: Request to correct confirmed policy discrepancies',
        '',
        `Report: ${r.id}, version ${r.version}`,
        `Approved snapshot checksum: ${request.snapshotHash}`,
        `Reviewed by: ${markdown(request.approval.reviewerId)} at ${request.approval.approvedAt} (UTC)`,
        '',
        'Please review these confirmed discrepancies against the agreed terms and provide the requested correction or clarification.',
        '',
      ];
      for (const f of findings) {
        const name = `Finding ${String(r.comparisons.findIndex(item => item.id === f.id) + 1).padStart(3, '0')}`;
        lines.push(
          `## ${name}: ${markdown(f.label)}`,
          '',
          `Finding identifier: ${f.id}`,
          `Expected terms: ${markdown(termValue(f.baseline?.value))}`,
          `Issued terms: ${markdown(termValue(f.actual?.value))}`,
          `Requested correction or clarification: ${markdown(f.action)}`,
          '',
        );
        for (const e of f.evidence) {
          const source = r.sources.find(source => source.sourceId === e.sourceId)!;
          lines.push(
            `Source document ${String(r.sources.indexOf(source) + 1).padStart(3, '0')}: ${markdown(source.displayName)} (${source.sourceId}), version ${markdown(e.version)}, ${e.physicalPage !== null ? 'physical page ' + e.physicalPage : 'record ' + markdown(e.recordId!) + ', field ' + markdown(e.field!)}.`,
            `> ${markdown(e.excerpt).replace(/\n/g, '\n> ')}`,
            '',
          );
        }
      }
      lines.push(
        'Broker contact: [Broker name and contact details]',
        '',
        'Proposed correction request — not sent. Review and edit before any separate delivery.',
      );
      const bytes =
        stage === 'reportOutput' ? await renderDraftPdf(r, request.approval) : Buffer.from(lines.join('\n'));
      const reference = request.operationId + extension;
      const target = resolve(context.outputDirectory, reference);
      const temporary = target + '.' + randomUUID() + '.tmp';
      try {
        const file = await open(temporary, 'wx', 0o600);
        try {
          await file.writeFile(bytes);
          await file.sync();
        } finally {
          await file.close();
        }
        await rename(temporary, target);
        const directory = await open(context.outputDirectory, 'r');
        try {
          await directory.sync();
        } finally {
          await directory.close();
        }
      } catch (error) {
        await unlink(temporary).catch(() => undefined);
        throw error;
      }
      const safe = (r.identity.policyNumber ?? r.caseId).replace(/[^A-Za-z0-9-]/g, '-').slice(0, 70);
      return {
        providerId: id,
        stage,
        operationId: request.operationId,
        snapshotId: r.id,
        snapshotHash: request.snapshotHash,
        approvalId: request.approval.id,
        hash: hashBytes(bytes),
        mediaType: stage === 'reportOutput' ? 'application/pdf' : 'text/markdown',
        displayName: `policy-check-${safe}-v${r.version}-${stage === 'reportOutput' ? 'final' : 'correction'}${extension}`,
        retrievalReference: reference,
      };
    },
    async retrieve(artifact, context) {
      const root = await realpath(context.outputDirectory);
      const path = resolve(root, artifact.retrievalReference);
      if (
        artifact.retrievalReference !== artifact.operationId + extension ||
        !path.startsWith(root + sep) ||
        (await realpath(path)) !== path
      )
        throw new IntakeError(
          'ARTIFACT_LOCATION',
          'The approved output location is invalid.',
          'Correct the selected output provider.',
        );
      const file = await open(path, 'r');
      try {
        return await file.readFile();
      } finally {
        await file.close();
      }
    },
  };
}
