/**
 * GitLab rule ingress — a parsed webhook delivery, evaluated and committed.
 *
 * Shaped after `integrations/linear/rules.ts`, with one structural difference:
 * Linear polls a project it already knows, while a GitLab delivery names only
 * its GitLab project. The Factory project is resolved from the intake source
 * binding, so an unbound project is ignored rather than guessed at.
 */
import { boardForWorkItem } from '../../boards/index.js';
import type { BoardRegistry } from '../../boards/index.js';
import type { FactoryGitlabRuleContext, FactoryRuleDecision } from '../../rules/types.js';
import { assertFactoryDecisionTarget, validateFactoryRuleDecisions } from '../../rules/validation.js';
import type { IntakeStorage } from '../../storage/domains/intake/base.js';
import type { FactoryProjectsStorage } from '../../storage/domains/projects/base.js';
import type { WorkItemRow, WorkItemsStorage } from '../../storage/domains/work-items/base.js';
import type { IntegrationContext } from '../base.js';
import type { GitlabEventRules } from './default-rules.js';
import type { ParsedGitlabWebhook } from './webhook.js';

const RULE_TIMEOUT_MS = 5_000;

async function withRuleTimeout<T>(promise: Promise<T>): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error('FACTORY_RULE_TIMEOUT')), RULE_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export interface GitlabRulesOptions {
  projects: Pick<FactoryProjectsStorage, 'get'>;
  intake: Pick<IntakeStorage, 'listBindingsByExternalSource'>;
  storage: WorkItemsStorage;
  configVersion: string;
  boards: BoardRegistry;
  gitlabRules: GitlabEventRules;
  /**
   * Username of the account Factory posts as in this org, when one is
   * connected. Factory writes notes and closes issues through that account, so
   * without it a handoff comment comes back as a delivery and the rules answer
   * their own message. `undefined` fails open: the delivery is treated as
   * external, matching GitHub's guard when identity cannot be resolved.
   */
  connectedAs?: (orgId: string) => Promise<string | undefined>;
}

/** `ignored` covers a delivery for a project no Factory is bound to. */
export type GitlabIngressStatus = 'committed' | 'replayed' | 'missing' | 'ignored';

export class GitlabRules {
  constructor(private readonly options: GitlabRulesOptions) {}

  /**
   * A GitLab delivery names its project and no tenant, so the org is resolved
   * from the source bindings. One GitLab project can feed several Factory
   * projects (in the same org or different ones); each is committed
   * independently so one org's failure cannot swallow another's card.
   */
  async ingest(input: { parsed: ParsedGitlabWebhook }): Promise<{ status: GitlabIngressStatus }> {
    const bindings = await this.options.intake.listBindingsByExternalSource({
      integrationId: 'gitlab',
      sourceId: String(input.parsed.project.id),
    });
    // No binding means no Factory owns this GitLab project. Ignoring it keeps a
    // shared instance's unrelated projects off every board.
    if (bindings.length === 0) return { status: 'ignored' };

    const statuses: GitlabIngressStatus[] = [];
    for (const binding of bindings) {
      const project = await this.options.projects.get({ orgId: binding.orgId, id: binding.factoryProjectId });
      if (!project) {
        statuses.push('missing');
        continue;
      }

      const items = await this.options.storage.list({
        orgId: binding.orgId,
        factoryProjectId: binding.factoryProjectId,
      });
      // Issues and merge requests share the `${projectId}!${iid}` ref grammar
      // and are numbered separately, so the type has to match too — otherwise
      // issue !7 and merge request !7 would resolve to each other's card.
      const subject = input.parsed.mergeRequest ?? input.parsed.issue;
      const subjectType = input.parsed.mergeRequest ? 'merge-request' : 'issue';
      if (!subject) {
        statuses.push('ignored');
        continue;
      }
      const relatedItem = items.find(
        item =>
          item.externalSource?.externalId === subject.ref &&
          item.externalSource?.integrationId === 'gitlab' &&
          item.externalSource?.type === subjectType,
      );
      statuses.push(await this.#commit(binding.orgId, binding, relatedItem, input.parsed));
    }

    if (statuses.some(status => status === 'committed')) return { status: 'committed' };
    if (statuses.some(status => status === 'replayed')) return { status: 'replayed' };
    return { status: statuses[0] ?? 'ignored' };
  }

  async #commit(
    orgId: string,
    binding: { factoryProjectId: string; board: string | null },
    relatedItem: WorkItemRow | undefined,
    parsed: ParsedGitlabWebhook,
  ): Promise<GitlabIngressStatus> {
    const ingressId = parsed.deliveryId;
    // A webhook delivery is GitLab speaking, not the person behind it: the
    // actor is the integration, so rules cannot mistake it for a human
    // approval.
    const actor = { type: 'system' as const, id: 'gitlab-webhook' };
    // Resolved per org, since the connected account differs between them.
    // A lookup failure reads as "not Factory" for this one delivery rather
    // than failing the ingest.
    const factoryAccount = await this.options.connectedAs?.(orgId).catch(() => undefined);
    const factoryAuthored = Boolean(
      factoryAccount && parsed.issueNote?.author && parsed.issueNote.author === factoryAccount,
    );
    const mergeRequestNoteAuthored = Boolean(
      factoryAccount && parsed.mergeRequestNote?.author && parsed.mergeRequestNote.author === factoryAccount,
    );
    const boundBoard = binding.board ? this.options.boards.get(binding.board) : undefined;

    const context: FactoryGitlabRuleContext = {
      tenant: { orgId, projectId: binding.factoryProjectId },
      actor,
      ingress: { type: 'gitlab', id: ingressId },
      cause: `gitlab.${parsed.event}`,
      causalChain: [],
      configVersion: this.options.configVersion,
      ...(relatedItem
        ? {
            item: {
              id: relatedItem.id,
              source: parsed.mergeRequest ? 'gitlab-mr' : 'gitlab-issue',
              sourceKey: relatedItem.externalSource?.externalId ?? null,
              parentWorkItemId: relatedItem.parentWorkItemId,
              title: relatedItem.title,
              url: relatedItem.externalSource?.url ?? null,
              stages: relatedItem.stages,
              acceptedAt: relatedItem.acceptedAt,
              metadata: relatedItem.metadata,
            },
            board: boardForWorkItem(relatedItem),
            itemRevision: relatedItem.revision,
          }
        : {}),
      ...(boundBoard ? { intake: { board: boundBoard.id, initialPhase: boundBoard.initialPhase } } : {}),
      event: parsed.event,
      deliveryId: parsed.deliveryId,
      project: parsed.project,
      ...(parsed.issue ? { issue: parsed.issue } : {}),
      ...(parsed.mergeRequest
        ? {
            mergeRequest: {
              ...parsed.mergeRequest,
              // Factory opens merge requests through the connected account, so
              // its own MR arrives as a delivery like any other.
              factoryAuthored: Boolean(factoryAccount && parsed.mergeRequest.author === factoryAccount),
            },
          }
        : {}),
      ...(parsed.issueNote ? { issueNote: { ...parsed.issueNote, factoryAuthored } } : {}),
      ...(parsed.mergeRequestNote
        ? { mergeRequestNote: { ...parsed.mergeRequestNote, factoryAuthored: mergeRequestNoteAuthored } }
        : {}),
    };

    const rule = this.options.gitlabRules[context.event];
    let decision: FactoryRuleDecision | void;
    let decisions: Record<string, unknown>[] = [];
    let outcome: { status: 'accepted' | 'rejected'; code?: string; reason?: string } = { status: 'accepted' };
    try {
      decision = rule ? await withRuleTimeout(Promise.resolve(rule(Object.freeze(context)))) : undefined;
      if (decision?.type === 'reject') {
        outcome = { status: 'rejected', code: decision.code, reason: decision.reason };
      } else if (decision) {
        decisions = validateFactoryRuleDecisions([decision]).map(entry => {
          assertFactoryDecisionTarget(
            entry,
            this.options.boards,
            relatedItem ? boardForWorkItem(relatedItem) : undefined,
          );
          return { ...entry };
        });
      }
    } catch (error) {
      const timedOut = error instanceof Error && error.message === 'FACTORY_RULE_TIMEOUT';
      outcome = {
        status: 'rejected',
        code: timedOut ? 'timeout' : 'rule_error',
        reason: timedOut
          ? 'Factory rule evaluation timed out.'
          : error instanceof Error
            ? error.message.slice(0, 2_000)
            : 'Factory GitLab rule failed.',
      };
    }

    const committed = await this.options.storage.commitRuleEvaluation({
      orgId,
      factoryProjectId: binding.factoryProjectId,
      workItemId: relatedItem?.id ?? null,
      ingress: { identity: ingressId, triggerType: `gitlab.${parsed.event}` },
      configVersion: this.options.configVersion,
      expectedRevision: relatedItem?.revision ?? null,
      actor,
      outcome,
      decisions,
      causalChain: [],
      now: new Date(),
    });
    return committed.status;
  }
}

export function attachGitlabRules(
  gitlab: { readonly rules: GitlabEventRules; connectedAccount(orgId: string): Promise<string | undefined> },
  context: IntegrationContext,
): ((input: { parsed: ParsedGitlabWebhook }) => Promise<{ status: GitlabIngressStatus }>) | undefined {
  if (!context.runtime) return undefined;
  const rules = new GitlabRules({
    projects: context.storage.projects,
    intake: context.storage.intake,
    storage: context.runtime.workItems,
    configVersion: context.runtime.configVersion,
    boards: context.runtime.boards,
    gitlabRules: gitlab.rules,
    connectedAs: orgId => gitlab.connectedAccount(orgId),
  });
  return input => rules.ingest(input);
}
