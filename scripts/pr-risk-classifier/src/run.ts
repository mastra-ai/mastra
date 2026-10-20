import type { WorkspaceIndex } from './blast-radius.ts';
import { classifyPullRequest, inputHash, type Classification } from './classify.ts';
import { MARKER_PREFIX, parseMarker, renderComment, renderFailureComment, RISK_LABELS } from './comment.ts';
import type { PullRequestApi } from './github.ts';
import type { ModelConfig } from './model.ts';
import { isRisk, RISK_LEVELS, type Risk } from './types.ts';

export type RunResult =
  | { status: 'skipped'; reason: string }
  | { status: 'unchanged'; risk: Risk }
  | { status: 'labeled'; risk: Risk; classification: Classification }
  | { status: 'failed'; error: string };

const RISK_LABEL_NAMES: string[] = RISK_LEVELS.map(level => RISK_LABELS[level].name);

/**
 * Rates one PR and makes it carry exactly one risk label plus one sticky comment.
 * A classifier failure leaves the existing label alone and says so in the comment.
 */
export async function run(input: {
  api: PullRequestApi;
  index: WorkspaceIndex;
  rubric: string;
  model: ModelConfig;
  /** Login of the bot that owns the sticky comment; comments by anyone else are never trusted or edited. */
  botLogin: string;
}): Promise<RunResult> {
  const { api } = input;
  const pull = await api.getPull();
  if (pull.draft) return { status: 'skipped', reason: 'Draft PRs are rated when they are marked ready for review.' };

  const files = await api.listFiles();
  const pr = { number: pull.number, title: pull.title, body: pull.body, files };
  const hash = inputHash(pr, input.rubric, input.model.model);

  const sticky = (await api.listComments()).find(c => c.author === input.botLogin && c.body.startsWith(MARKER_PREFIX));
  const previous = parseMarker(sticky?.body);
  const currentLabels = pull.labels.filter(name => RISK_LABEL_NAMES.includes(name));
  if (previous?.hash === hash && currentLabels.length === 1 && currentLabels[0] === RISK_LABELS[previous.risk].name) {
    return { status: 'unchanged', risk: previous.risk };
  }

  let classification: Classification;
  try {
    classification = await classifyPullRequest({ pr, index: input.index, rubric: input.rubric, model: input.model });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const labeled = currentLabels.map(name => name.replace(/^risk: /, '')).find(isRisk) ?? null;
    await upsert(api, sticky?.id, renderFailureComment(labeled, message));
    return { status: 'failed', error: message };
  }

  const target = RISK_LABELS[classification.risk];
  await api.ensureLabel(target);
  for (const name of currentLabels) if (name !== target.name) await api.removeLabel(name);
  if (!currentLabels.includes(target.name)) await api.addLabel(target.name);
  await upsert(api, sticky?.id, renderComment(classification, hash));
  return { status: 'labeled', risk: classification.risk, classification };
}

async function upsert(api: PullRequestApi, id: number | undefined, body: string) {
  if (id === undefined) await api.createComment(body);
  else await api.updateComment(id, body);
}
