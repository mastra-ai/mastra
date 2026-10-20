import { createHash } from 'node:crypto';
import type { FileContext, PackageBlastRadius, WorkspaceIndex } from './blast-radius.ts';
import { selectHunks } from './diff.ts';
import { fileKind, floors as computeFloors, prefilter, type Floor } from './files.ts';
import { buildMessages, requestVerdict, type ModelConfig } from './model.ts';
import { parseSelfReportedRisk } from './self-reported.ts';
import { maxRisk, type PullRequestInput, type Risk } from './types.ts';

export const DEFAULT_DIFF_BUDGET_CHARS = 60_000;

export type AffectedPackage = PackageBlastRadius & { owners: string[]; files: number };

export type Classification = {
  risk: Risk;
  source: 'prefilter' | 'model';
  summary: string;
  drivers: Array<{ file: string; reason: string }>;
  blastRadius: string;
  packages: AffectedPackage[];
  /** Floors that raised the model's rating. */
  appliedFloors: Floor[];
  modelRisk: Risk | null;
  selfReported: Risk | null;
  hunks: { reviewed: number; total: number };
  model: string | null;
};

export async function classifyPullRequest(input: {
  pr: PullRequestInput;
  index: WorkspaceIndex;
  rubric: string;
  model: ModelConfig;
  budgetChars?: number;
}): Promise<Classification> {
  const { pr, index, rubric, model } = input;
  const selfReported = parseSelfReportedRisk(pr.body);
  const contexts = new Map<string, FileContext>(pr.files.map(f => [f.filename, index.fileContext(f.filename)]));
  const packages = affectedPackages(pr, contexts);

  const quick = prefilter(pr.files);
  if (quick) {
    return {
      risk: quick.risk,
      source: 'prefilter',
      summary: quick.reason,
      drivers: [],
      blastRadius: '',
      packages,
      appliedFloors: [],
      modelRisk: null,
      selfReported,
      hunks: { reviewed: 0, total: 0 },
      model: null,
    };
  }

  const selection = selectHunks(pr.files, contexts, input.budgetChars ?? DEFAULT_DIFF_BUDGET_CHARS);
  const messages = buildMessages({ pr, selection, contexts, rubric });
  const verdict = await requestVerdict(model, messages, pr.files.map(f => f.filename));

  let risk = verdict.risk;
  const appliedFloors: Floor[] = [];
  for (const floor of computeFloors(pr.files)) {
    if (maxRisk(risk, floor.risk) !== risk) appliedFloors.push(floor);
  }
  for (const floor of appliedFloors) risk = maxRisk(risk, floor.risk);

  return {
    risk,
    source: 'model',
    summary: verdict.summary,
    drivers: verdict.drivers,
    blastRadius: verdict.blastRadius,
    packages,
    appliedFloors,
    modelRisk: verdict.risk,
    selfReported,
    hunks: { reviewed: selection.included.length, total: selection.included.length + selection.omitted.length },
    model: model.model,
  };
}

function affectedPackages(pr: PullRequestInput, contexts: Map<string, FileContext>): AffectedPackage[] {
  const byName = new Map<string, AffectedPackage>();
  for (const file of pr.files) {
    const ctx = contexts.get(file.filename);
    if (!ctx?.package || ['docs', 'changeset', 'test'].includes(fileKind(file.filename))) continue;
    const existing = byName.get(ctx.package.name);
    if (existing) {
      existing.files++;
      for (const owner of ctx.owners) if (!existing.owners.includes(owner)) existing.owners.push(owner);
    } else {
      byName.set(ctx.package.name, { ...ctx.package, owners: [...ctx.owners], files: 1 });
    }
  }
  return [...byName.values()].sort((a, b) => b.transitiveDependents - a.transitiveDependents);
}

/** Identifies everything the rating depends on, so unchanged PRs skip the model call. */
export function inputHash(pr: PullRequestInput, rubric: string, model: string): string {
  const hash = createHash('sha256');
  hash.update(JSON.stringify({ rubric, model, selfReported: parseSelfReportedRisk(pr.body) }));
  for (const file of [...pr.files].sort((a, b) => a.filename.localeCompare(b.filename))) {
    hash.update(JSON.stringify([file.filename, file.previous_filename ?? '', file.status, file.sha ?? '', file.patch ?? '']));
  }
  return hash.digest('hex').slice(0, 16);
}
