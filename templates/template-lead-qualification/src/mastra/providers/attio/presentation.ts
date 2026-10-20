import { digestValue } from '../../review/contracts';
import { parseAttioMetadata } from './metadata';
import type { Assessment } from '../../research/contracts';
import type { OwnedPatch } from '../../review/contracts';
import { actions, labels, presentAssessment } from '../../review/presentation';

function outcomeAction(classification: OwnedPatch['classification'], human = false, compact = false) {
  return {
    needs_review: `Check the findings, then move ${compact ? 'Stage' : 'Qualification stage'} to Qualified, Nurture or Disqualified. ${compact ? 'Justification' : 'Review justification'} is optional.`,
    qualified: human
      ? 'Contact the lead to confirm the buying need and agree on the next step.'
      : 'Contact the lead about the supported inquiry.',
    nurture: 'Keep this account in nurture and ask about a current buying need.',
    disqualified: human
      ? 'Do not pursue this lead under its current classification. Revisit it if new evidence changes the decision.'
      : 'This account is outside your target profile. Revisit it if new evidence changes the fit.',
  }[classification];
}
export function finalizeAttioPatch(patch: OwnedPatch): OwnedPatch {
  return patch.presentationVersion !== undefined
    ? {
        ...patch,
        nextAction: `SDR conclusion: ${labels[patch.classification]}. ${outcomeAction(patch.classification, true)}`,
      }
    : patch;
}
export function presentAttioPatch(assessment: Assessment, patch: OwnedPatch, compact = false): OwnedPatch {
  const reviewAction = compact ? 'Review the findings and move Stage to your final outcome.' : actions.policy;
  const nextAction =
    assessment.identity.status !== 'resolved' ? actions.identity : outcomeAction(patch.classification, false, compact);
  return presentAssessment(assessment, patch, nextAction, reviewAction);
}
export function attioPresentation(patch: OwnedPatch) {
  const links = patch.evidenceLinks.filter(source => {
    try {
      const url = new URL(source);
      return url.protocol === 'https:' && !url.username && !url.password;
    } catch {
      return false;
    }
  });
  return {
    evidenceLinks: links.length
      ? `Public sources\n\n${links.join('\n')}`
      : 'No public source links. Submitted or internal evidence remains in the full assessment.',
    gaps: patch.gaps.length
      ? `Facts to confirm\n\n${patch.gaps.map(gap => `• ${gap}`).join('\n\n')}`
      : 'No unresolved qualification facts.',
    reviewReasons: patch.reviewReasons.length
      ? `${patch.reviewId ? 'Why review is needed' : 'Additional findings'}\n\n${patch.reviewReasons.map(reason => `${labels[reason.attribute]}\n${reason.explanation}\nNext step: ${reason.action}`).join('\n\n')}`
      : 'No human review required by the captured policy.',
  };
}

export function compactAttioSummary(patch: OwnedPatch) {
  const presentation = attioPresentation(patch);
  return [
    patch.summary,
    `Current outcome: ${labels[patch.classification]}\nScore: ${patch.score}/100`,
    presentation.evidenceLinks,
    presentation.gaps,
    `Next action\n${patch.nextAction}`,
  ].join('\n\n');
}

/** After detail expiry only an exact machine-output fingerprint authorizes fresh research. */
export function attioRetentionDigest(fields: Record<string, unknown>, reviewFields: readonly string[]) {
  return digestValue(
    Object.fromEntries(
      Object.entries(fields)
        .filter(([key]) => !reviewFields.includes(key))
        .map(([key, value]) => [key, key === 'metadata' ? parseAttioMetadata(value).output : value]),
    ),
  );
}
