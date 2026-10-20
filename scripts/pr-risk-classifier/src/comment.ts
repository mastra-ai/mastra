import type { Classification } from './classify.ts';
import { clean } from './model.ts';
import type { Risk } from './types.ts';

export const MARKER_PREFIX = '<!-- pr-risk-classifier';

export const RISK_LABELS: Record<Risk, { name: string; color: string; description: string }> = {
  low: { name: 'risk: low', color: '0e8a16', description: 'PR risk classifier: low risk change' },
  medium: { name: 'risk: medium', color: 'fbca04', description: 'PR risk classifier: medium risk change' },
  high: { name: 'risk: high', color: 'b60205', description: 'PR risk classifier: high risk change' },
};

export function renderMarker(hash: string, risk: Risk): string {
  return `${MARKER_PREFIX} hash=${hash} risk=${risk} -->`;
}

export function parseMarker(body: string | null | undefined): { hash: string; risk: Risk } | null {
  const match = /<!-- pr-risk-classifier hash=([0-9a-f]+) risk=(low|medium|high) -->/.exec(body ?? '');
  return match ? { hash: match[1]!, risk: match[2] as Risk } : null;
}

export function renderComment(result: Classification, hash: string): string {
  const lines = [renderMarker(hash, result.risk), `### PR risk: \`${result.risk}\``, '', result.summary];

  if (result.drivers.length > 0) {
    lines.push('', '**What drove the rating**');
    for (const driver of result.drivers) lines.push(`- \`${driver.file}\`: ${driver.reason}`);
  }

  if (result.blastRadius) lines.push('', `**Blast radius:** ${result.blastRadius}`);

  if (result.packages.length > 0) {
    lines.push('', '| Package | In-repo dependents (direct / transitive) | Owners |', '| --- | --- | --- |');
    for (const pkg of result.packages.slice(0, 8)) {
      const owners = pkg.owners.map(o => `\`${o}\``).join(' ') || 'none';
      lines.push(`| \`${pkg.name}\` | ${pkg.directDependents} / ${pkg.transitiveDependents} | ${owners} |`);
    }
    if (result.packages.length > 8) lines.push(`| …and ${result.packages.length - 8} more | | |`);
  }

  if (result.appliedFloors.length > 0) {
    lines.push('', `**Raised from \`${result.modelRisk}\`** by fixed rules the model cannot lower:`);
    for (const floor of result.appliedFloors.slice(0, 5)) lines.push(`- \`${floor.file}\`: ${floor.reason} (at least \`${floor.risk}\`)`);
  }

  if (result.selfReported && result.selfReported !== result.risk) {
    lines.push('', `> [!NOTE]\n> The PR description says \`Risk: ${result.selfReported}\`, but the classifier rated it \`${result.risk}\`. Reviewers should check which is right.`);
  }

  const how = result.source === 'prefilter'
    ? 'Rated by a deterministic rule without a model call.'
    : `Rated by \`${clean(result.model ?? '', 80)}\` from ${result.hunks.reviewed} of ${result.hunks.total} diff hunks.`;
  lines.push('', `<sub>${how} The rubric lives in \`scripts/pr-risk-classifier/rubric.md\`. The label is advisory and is recomputed when the diff changes.</sub>`);
  return lines.join('\n');
}

export function renderFailureComment(previous: Risk | null, error: string): string {
  return [
    `${MARKER_PREFIX} failed -->`,
    '### PR risk: not rated',
    '',
    `The classifier could not rate the latest changes${previous ? `, so the \`${previous}\` label may be out of date` : ''}. It will retry on the next push.`,
    '',
    `<sub>${clean(error, 300)}</sub>`,
  ].join('\n');
}
