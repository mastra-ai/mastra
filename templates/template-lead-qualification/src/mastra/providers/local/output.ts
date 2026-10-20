import { z } from 'zod';
import type { Client } from '@libsql/client';
import type { NormalizedEvent } from '../../contracts';
import type { Assessment } from '../../research/contracts';
import type { OwnedPatch } from '../../review/contracts';
import { digestValue } from '../../review/contracts';
import { actions, presentAssessment } from '../../review/presentation';
import { ownedState } from '../output';
import { projectLocalPatch } from '../../observability/local-report';
import type { OutputProvider } from '../output';

const reportFields = ['reportText', 'reportMarkdown'] as const;
export function localOwnedState(fields: Record<string, unknown>) {
  return {
    ...ownedState(fields),
    ...Object.fromEntries(reportFields.filter(key => key in fields).map(key => [key, fields[key]])),
  };
}

/** Local compare-and-set persists readable reports and the operation marker with owned business fields. */
export class LocalOutputProvider implements OutputProvider {
  readonly id = 'local';
  readonly project = projectLocalPatch;
  readonly owned = localOwnedState;
  present(assessment: Assessment, patch: OwnedPatch): OwnedPatch {
    return presentAssessment(
      assessment,
      patch,
      assessment.identity.status !== 'resolved'
        ? actions.identity
        : {
            needs_review:
              'Review the findings with reviewLead in Studio or the review API, then confirm a final outcome.',
            qualified: 'Contact the lead about the supported buying inquiry.',
            nurture: 'Keep this account in nurture and ask about a current buying need.',
            disqualified: 'This account is outside your target profile. Revisit it if new evidence changes the fit.',
          }[patch.classification],
      'Review the findings with reviewLead in Studio or the review API and confirm a final outcome.',
    );
  }
  finalize(patch: OwnedPatch): OwnedPatch {
    return patch.presentationVersion === undefined
      ? patch
      : {
          ...patch,
          nextAction: {
            qualified: 'Contact the lead to confirm the buying need and agree on the next step.',
            nurture: 'Keep this account in nurture and ask about a current buying need.',
            disqualified:
              'Do not pursue this lead under its current classification. Revisit it if new evidence changes the decision.',
            needs_review: patch.nextAction,
          }[patch.classification],
        };
  }
  constructor(private readonly client: Client) {}
  async read(destination: NormalizedEvent['destination']) {
    const row = (
      await this.client.execute({
        sql: 'SELECT * FROM lead_local_destinations WHERE reference=?',
        args: [destination.reference],
      })
    ).rows[0];
    if (!row) return null;
    const fields = JSON.parse(z.string().parse(row.fields_json)) as Record<string, unknown>;
    return {
      fields,
      marker: row.marker === null ? null : z.string().parse(row.marker),
      ...(typeof fields.reportText === 'string' && typeof fields.reportMarkdown === 'string'
        ? { content: { text: fields.reportText, markdown: fields.reportMarkdown } }
        : {}),
    };
  }
  async apply(
    destination: NormalizedEvent['destination'],
    operationId: string,
    patch: OwnedPatch,
    expected: Record<string, unknown>,
    _expectedRevision?: string,
  ) {
    const current = await this.read(destination);
    if (!current || digestValue(localOwnedState(current.fields)) !== digestValue(expected))
      throw new Error('destination_conflict');
    const changed = await this.client.execute({
      sql: 'UPDATE lead_local_destinations SET fields_json=?,marker=? WHERE reference=? AND fields_json=? AND marker IS ?',
      args: [
        JSON.stringify({ ...current.fields, ...projectLocalPatch(patch) }),
        operationId,
        destination.reference,
        JSON.stringify(current.fields),
        current.marker,
      ],
    });
    if (changed.rowsAffected !== 1) throw new Error('destination_conflict');
  }
}
