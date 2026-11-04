import type { OwnedPatch } from '../review/contracts';
import { ownedState } from '../providers/output';

const line = (value: string) => value.replaceAll('\r', '').replaceAll('\n', ' ');
const markdown = (value: string) => line(value).replace(/[\\`*_{}[\]<>#]/g, '\\$&');

/** Render only the exact authorized patch; no model calls or extra interpretation occur here. */
export function projectLocalPatch(patch: OwnedPatch) {
  const fields = ownedState(patch);
  if (patch.presentationVersion === undefined) return fields;
  const sections: Array<[string, string[]]> = [
    ['Summary', [patch.summary]],
    ['Review', [patch.reviewStatus, ...(patch.overrideReason ? [patch.overrideReason] : [])]],
    ['Reasons', patch.reviewReasons.map(reason => `${reason.explanation} ${reason.action}`)],
    ['Gaps', patch.gaps],
    ['Sources', patch.evidenceLinks],
    ['Next action', [patch.nextAction]],
  ];
  return {
    ...fields,
    reportText: [
      `Lead qualification: ${patch.stage}`,
      `Score: ${patch.score}/100`,
      ...sections
        .filter(([, values]) => values.length)
        .flatMap(([title, values]) => ['', `${title}:`, ...values.map(line)]),
    ].join('\n'),
    reportMarkdown: [
      `# Lead qualification: ${patch.stage}`,
      `**Score:** ${patch.score}/100`,
      ...sections
        .filter(([, values]) => values.length)
        .flatMap(([title, values]) => ['', `## ${title}`, ...values.map(value => `- ${markdown(value)}`)]),
    ].join('\n'),
  };
}
