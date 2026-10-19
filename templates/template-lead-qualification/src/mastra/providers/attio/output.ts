import type { AttioConfig } from '../../config/attio';
import { attioOutputNames, attioReviewFields, compactAttioFieldNames } from '../../config/attio';
import type { NormalizedEvent } from '../../contracts';
import { digestValue } from '../../review/contracts';
import type { OwnedPatch } from '../../review/contracts';
import { attioPresentation, compactAttioSummary, finalizeAttioPatch, presentAttioPatch } from './presentation';
import { parseAttioMetadata } from './metadata';
import { OutputError } from '../output';
import type { DestinationState, OutputProvider } from '../output';
import type { AttioClient, AttioEntry } from './client';

export class AttioOutputProvider implements OutputProvider {
  readonly id = 'attio';
  readonly reviewMode = 'external';
  present(assessment: Parameters<typeof presentAttioPatch>[0], patch: OwnedPatch) {
    const presented = presentAttioPatch(assessment, patch, this.client.config.layoutVersion === 2);
    return this.client.config.layoutVersion === 2 ? { ...presented, presentationVersion: 2 as const } : presented;
  }
  readonly finalize = finalizeAttioPatch;
  get reviewFields(): readonly string[] {
    return this.client.config.layoutVersion === 2 ? ['stage', 'reviewJustification'] : ['stage', ...attioReviewFields];
  }
  owned(fields: Record<string, unknown>) {
    return Object.fromEntries(
      (this.client.config.layoutVersion === 2 ? compactAttioFieldNames : attioOutputNames)
        .filter(name => name in fields)
        .map(name => [name, fields[name]]),
    );
  }
  project(patch: OwnedPatch, operationId: string, expected?: Record<string, unknown>) {
    const { overrideClassification: _classification, overrideReason, presentationVersion, ...fields } = patch;
    const metadata =
      presentationVersion === 2 && expected?.metadata !== undefined ? parseAttioMetadata(expected.metadata) : undefined;
    const expectedClassification =
      presentationVersion === 2 ? metadata?.output?.classification : expected?.classification;
    const presentation = presentationVersion ? attioPresentation(patch) : undefined;
    const closure = ['Rejected', 'Changes requested'].includes(patch.reviewStatus);
    const projected = {
      ...fields,
      ...presentation,
      ...(closure && expected ? { classification: expectedClassification } : {}),
      reviewJustification:
        presentationVersion && expected && 'reviewJustification' in expected
          ? expected.reviewJustification
          : closure
            ? (expected?.reviewJustification ?? null)
            : overrideReason,
      operationId,
      outputState: patch.reviewStatus === 'Awaiting review' ? 'Pending' : 'Applied',
      appliedAssessmentId:
        patch.reviewStatus === 'Not required' || patch.reviewStatus === 'Approved' ? patch.assessmentId : null,
    };
    if (presentationVersion === 2) {
      const { stage, summary: _summary, reviewJustification, ...output } = projected;
      const input = metadata?.input;
      return {
        stage,
        summary: compactAttioSummary(patch),
        reviewJustification,
        metadata: JSON.stringify({
          version: 2,
          ...(input ? { input } : {}),
          output: {
            ...output,
            evidenceLinks: patch.evidenceLinks,
            gaps: patch.gaps,
            reviewReasons: patch.reviewReasons,
          },
        }),
      };
    }
    return Object.fromEntries(
      attioOutputNames.filter(name => name in projected).map(name => [name, projected[name as keyof typeof projected]]),
    );
  }
  readonly retryPolicy;
  constructor(readonly client: AttioClient) {
    this.retryPolicy = client.config.limits;
  }
  legacyRevision(entry: AttioEntry) {
    return digestValue(attioReviewFields.map(name => this.client.value(entry, name) ?? null));
  }
  revision(entry: AttioEntry) {
    return `stage-v1:${digestValue(this.reviewFields.map(name => this.client.value(entry, name as keyof AttioConfig['fields']) ?? null))}`;
  }
  matchesRevision(state: DestinationState, expected: string) {
    return expected.startsWith('stage-v1:') ? state.revision === expected : state.legacyRevision === expected;
  }
  async read(destination: NormalizedEvent['destination']) {
    const entry = await this.client.entry(destination.reference);
    const fields = this.client.fields(entry);
    return {
      fields,
      marker: typeof fields.operationId === 'string' ? fields.operationId : null,
      revision: this.revision(entry),
      legacyRevision: this.legacyRevision(entry),
    };
  }
  async apply(
    destination: NormalizedEvent['destination'],
    operationId: string,
    patch: OwnedPatch,
    expected: Record<string, unknown>,
    expectedRevision?: string,
  ) {
    const current = await this.read(destination);
    if (
      digestValue(this.owned(current.fields)) !== digestValue(expected) ||
      (expectedRevision !== undefined && !this.matchesRevision(current, expectedRevision))
    )
      throw new OutputError('attio_destination_conflict', false);
    await this.client.update(destination.reference, this.project(patch, operationId, expected));
  }
}
