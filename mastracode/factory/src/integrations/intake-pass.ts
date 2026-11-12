import type { IntakeSourceBinding, IntakeStorage } from '../storage/domains/intake/base.js';
import type { IntegrationStorage, IntegrationStorageHandle } from '../storage/domains/integrations/base.js';
import type { FactoryProjectsStorage } from '../storage/domains/projects/base.js';
import type { SourceControlStorageHandle } from '../storage/domains/source-control/base.js';
import type {
  Card,
  ExternalWorkItemSource,
  IntakeCandidate,
  WorkItemsStorage,
} from '../storage/domains/work-items/base.js';
import { candidateIsCurrent } from '../storage/domains/work-items/candidates.js';
import type { IssueReconcileSummary } from './issue-reconciler.js';

/** Pages of a just-bound source offered to the rules, as linking a GitHub repository does. */
export const INTAKE_IMPORT_MAX_PAGES = 5;
/** A listing longer than this is not read to the end, so the pass removes nothing. */
export const INTAKE_PASS_MAX_PAGES = 100;
const CANDIDATE_PAGE = 200;

export type IntakeKind = 'issue' | 'pull-request';

/** An open record of a provider, as the Intake column offers it. */
export interface IntakeRecord {
  source: ExternalWorkItemSource;
  title: string;
  description?: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date | null;
}

export interface IntakeSettleSummary {
  /** Records handed to the rules: new ones only, each once. */
  offered: number;
  /** Candidates added or changed. */
  stored: number;
  removed: number;
}

export type CandidateStore = Pick<
  WorkItemsStorage,
  | 'listShared'
  | 'getByProjectSource'
  | 'listIntakeCandidates'
  | 'getIntakeCandidate'
  | 'storeIntakeCandidate'
  | 'removeIntakeCandidate'
>;

export interface IntakeListing<T> {
  storage: CandidateStore;
  orgId: string;
  factoryProjectId: string;
  integrationId: string;
  kind: IntakeKind;
  record(item: T): IntakeRecord;
  /** Names a card may hold the record under, beyond its source id (an older id format, a stable provider id). */
  itemKeys?(item: T): readonly string[];
  cardKeys?(card: Card): readonly string[];
  /** The stored candidates this listing speaks for; the others are left alone. */
  covers?(candidate: IntakeCandidate): boolean;
  /** Created after its source was linked, or part of the import that linking runs. */
  eligible(item: T): boolean;
  /** Hand new records to the provider's rules, which file a card for the ones they take. */
  offer(items: T[]): Promise<unknown>;
  /** The listed records that have a card, for a provider whose cards the listing keeps current. */
  refresh?(items: T[]): Promise<unknown>;
}

/** A project's candidates being brought in line with one listing of a provider's open records. */
export interface IntakeSettlement<T> {
  /** Settle one page of the listing, as soon as the provider has answered it. */
  page(items: readonly T[]): Promise<void>;
  /**
   * End the listing. `complete` says it was read to the end; only then are the candidates it
   * lacks removed.
   */
  finish(complete: boolean): Promise<IntakeSettleSummary>;
}

async function storedCandidates(listing: IntakeListing<never>): Promise<Map<string, IntakeCandidate>> {
  const stored = new Map<string, IntakeCandidate>();
  let after: { createdAt: Date; id: string } | undefined;
  for (;;) {
    const page = await listing.storage.listIntakeCandidates({
      orgId: listing.orgId,
      factoryProjectId: listing.factoryProjectId,
      kind: listing.kind,
      integrationId: listing.integrationId,
      ...(after ? { after } : {}),
      limit: CANDIDATE_PAGE,
    });
    for (const candidate of page.candidates) {
      if (!listing.covers || listing.covers(candidate)) stored.set(candidate.externalSource.externalId, candidate);
    }
    if (!page.next) return stored;
    after = page.next;
  }
}

const versionOf = (candidate: IntakeCandidate) => ({ id: candidate.source.id, revision: candidate.source.revision });

/**
 * Start bringing a project's candidates in line with a listing of a provider's open records. Call
 * this before the first page is asked for: the candidates read here are all the listing may change
 * or remove. An event that lands while the provider is being listed knows more than the listing
 * does, so what it stored, changed or removed since is left as the event left it.
 *
 * A record with a card is left to the card's own sync, a candidate is refreshed, and a record seen
 * for the first time goes to the rules once when it is eligible: whatever they do not file is kept
 * as a candidate, which is what stops the next pass offering it again.
 */
export async function openIntakeSettlement<T>(listing: IntakeListing<T>): Promise<IntakeSettlement<T>> {
  const { storage, orgId, factoryProjectId } = listing;
  const project = { orgId, factoryProjectId };
  const summary: IntakeSettleSummary = { offered: 0, stored: 0, removed: 0 };
  const known = await storedCandidates(listing as IntakeListing<never>);
  const seen = new Set<string>();

  let cards: Promise<Set<string>> | undefined;
  const carded = () =>
    (cards ??= storage.listShared(project).then(listed => {
      const keys = new Set<string>();
      for (const card of listed) {
        if (card.externalSource?.integrationId !== listing.integrationId) continue;
        keys.add(card.externalSource.externalId);
        for (const key of listing.cardKeys?.(card) ?? []) keys.add(key);
      }
      return keys;
    }));

  const store = async (record: IntakeRecord, expected: ReturnType<typeof versionOf> | null) => {
    const written = await storage.storeIntakeCandidate({ ...project, ...record, expected });
    if (written === 'created' || written === 'updated') summary.stored += 1;
  };

  return {
    async page(items) {
      if (items.length === 0) return;
      const held: T[] = [];
      const fresh: T[] = [];
      const keys = await carded();
      for (const item of items) {
        const record = listing.record(item);
        const id = record.source.externalId;
        if (seen.has(id)) continue;
        seen.add(id);
        if (keys.has(id) || listing.itemKeys?.(item).some(key => keys.has(key))) {
          held.push(item);
          continue;
        }
        const candidate = known.get(id);
        if (candidate) {
          // Nothing is written for a candidate the provider has not changed, which is most of them.
          if (!candidateIsCurrent(candidate, record)) await store(record, versionOf(candidate));
          continue;
        }
        if (!listing.eligible(item)) {
          await store(record, null);
          continue;
        }
        // A pull request attached to an issue's card is held by that card and is never a candidate.
        if (await storage.getByProjectSource({ ...project, source: record.source })) continue;
        // Stored since the listing began: by an event, whose rules have had the record already.
        if (await storage.getIntakeCandidate({ ...project, source: record.source })) continue;
        fresh.push(item);
      }

      if (held.length > 0) await listing.refresh?.(held);
      if (fresh.length > 0) {
        await listing.offer(fresh);
        summary.offered += fresh.length;
        // Stored whatever the rules decided: a record they take is filed by a later decision, and the
        // card adopts its candidate then. One already filed has a card, and storing it is a no-op.
        for (const item of fresh) await store(listing.record(item), null);
      }
    },
    async finish(complete) {
      if (!complete) return summary;
      for (const [id, candidate] of known) {
        if (seen.has(id)) continue;
        const removed = await storage.removeIntakeCandidate({
          ...project,
          source: candidate.externalSource,
          expected: versionOf(candidate),
        });
        if (removed) summary.removed += 1;
      }
      return summary;
    },
  };
}

/** What the last pass over one project's records of a provider came to. */
export interface IntakePassStatus {
  version: 1;
  /** When the open records were last read to the end. */
  completeAt: string | null;
  /** Set while the latest pass failed; the next one that succeeds clears it. */
  failedAt: string | null;
  error: string | null;
  /** Sources whose import at link time has run, by the time each was bound. */
  imported: Record<string, string>;
  /** Sources whose open records have all been read since they were bound, by that same time. */
  listed: Record<string, string>;
}

export type IntakePassStatusStore = Pick<IntegrationStorageHandle['settings'], 'get' | 'save'>;

const NO_STATUS: IntakePassStatus = {
  version: 1,
  completeAt: null,
  failedAt: null,
  error: null,
  imported: {},
  listed: {},
};

/** The settings row a pass keeps its status in; the `user` half of the key names the project and kind. */
export function intakePassStatusKey(factoryProjectId: string, kind: IntakeKind): string {
  return `intake-pass:${factoryProjectId}:${kind}`;
}

export async function readIntakePassStatus(
  store: IntakePassStatusStore,
  scope: { orgId: string; factoryProjectId: string; kind: IntakeKind },
): Promise<IntakePassStatus | null> {
  const value = (await store.get(scope.orgId, intakePassStatusKey(scope.factoryProjectId, scope.kind))) as unknown;
  if (!value || typeof value !== 'object' || (value as { version?: unknown }).version !== 1) return null;
  return { ...NO_STATUS, ...(value as Partial<IntakePassStatus>) };
}

/** Every pass a project can have: the provider and the kind of record it lists. */
export const INTAKE_PASSES = [
  { integrationId: 'github', kind: 'issue' },
  { integrationId: 'github', kind: 'pull-request' },
  { integrationId: 'gitlab', kind: 'issue' },
  { integrationId: 'gitlab', kind: 'pull-request' },
  { integrationId: 'linear', kind: 'issue' },
  { integrationId: 'jira', kind: 'issue' },
  { integrationId: 'incidentio', kind: 'issue' },
] as const satisfies ReadonlyArray<{ integrationId: string; kind: IntakeKind }>;

export interface IntakePassReport {
  integrationId: string;
  kind: IntakeKind;
  /** When the provider's open records were last read to the end; `null` before the first such pass. */
  completeAt: string | null;
  /** Whether the latest pass failed, which leaves the list as the pass before it left it. */
  failed: boolean;
}

/** How fresh a project's candidates are, for every pass that has run over it: one read. */
export async function readIntakePassReports(
  settings: Pick<IntegrationStorage, 'listSettings'>,
  scope: { orgId: string; factoryProjectId: string },
): Promise<IntakePassReport[]> {
  const rows = await settings.listSettings<Partial<IntakePassStatus>>({
    orgId: scope.orgId,
    integrationIds: [...new Set(INTAKE_PASSES.map(pass => pass.integrationId))],
    userIds: [...new Set(INTAKE_PASSES.map(pass => intakePassStatusKey(scope.factoryProjectId, pass.kind)))],
  });
  return INTAKE_PASSES.flatMap(pass => {
    const key = intakePassStatusKey(scope.factoryProjectId, pass.kind);
    const status = rows.find(row => row.integrationId === pass.integrationId && row.userId === key)?.config;
    if (!status) return [];
    return [{ ...pass, completeAt: status.completeAt ?? null, failed: Boolean(status.failedAt) }];
  });
}

function saveIntakePassStatus(
  store: IntakePassStatusStore,
  scope: { orgId: string; factoryProjectId: string; kind: IntakeKind },
  status: IntakePassStatus,
): Promise<void> {
  return store.save(scope.orgId, intakePassStatusKey(scope.factoryProjectId, scope.kind), { ...status });
}

/** One organization's access to a provider for the length of a pass. */
export interface OrgIntakeListing<T> {
  /** The sources a project takes records from, and when each was bound to it. */
  sources(factoryProjectId: string): ReadonlyMap<string, Date>;
  list(
    factoryProjectId: string,
    sourceIds: string[],
    cursor: string | undefined,
  ): Promise<{ items: T[]; nextCursor: string | null }>;
}

export interface IntakePassOptions<T> {
  integrationId: string;
  kind: IntakeKind;
  projects: Pick<FactoryProjectsStorage, 'listAll'>;
  storage: CandidateStore;
  status: IntakePassStatusStore;
  /** `null` when the organization has no connection to the provider. */
  open(orgId: string, factoryProjectIds: string[]): Promise<OrgIntakeListing<T> | null>;
  /**
   * Whether the first pass after a source is bound hands its newest records to the rules. Off for
   * a provider that runs that import itself when the source is linked.
   */
  importsAtBind: boolean;
  record(item: T): IntakeRecord;
  /** The bound source the item was listed from. */
  sourceId(item: T): string | null | undefined;
  itemKeys?(item: T): readonly string[];
  cardKeys?(card: Card): readonly string[];
  offer(project: { orgId: string; factoryProjectId: string }, items: T[]): Promise<unknown>;
  refresh?(items: T[]): Promise<unknown>;
  now?: () => Date;
}

/**
 * What a scoped run covers: one project, or every project whose sources are not the ones its last
 * pass read, because one was linked, picked or dropped since.
 */
export type IntakePassScope = { orgId: string; factoryProjectId: string } | { changedSources: true };

/** Runs over every project, or over the ones the scope names. */
export type IntakePass = (only?: IntakePassScope) => Promise<IntakePassSummary>;

export interface IntakePassSummary extends IntakeSettleSummary {
  projects: number;
  failed: number;
  errors: Array<{ projectId: string; error: string }>;
}

function sameBindings(left: Record<string, string>, right: Record<string, string>): boolean {
  const ids = Object.keys(left);
  return ids.length === Object.keys(right).length && ids.every(id => left[id] === right[id]);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * The pass that keeps a provider's candidates: each run lists every project's bound sources once
 * and settles the project against that listing. Provider calls depend on the bound sources and
 * their open records, never on who has a board open.
 */
export function createIntakePass<T>(options: IntakePassOptions<T>): IntakePass {
  const now = options.now ?? (() => new Date());
  const { integrationId, kind, storage } = options;

  return async function pass(only): Promise<IntakePassSummary> {
    const summary: IntakePassSummary = { projects: 0, offered: 0, stored: 0, removed: 0, failed: 0, errors: [] };
    const byOrg = new Map<string, string[]>();
    const projects =
      only && 'factoryProjectId' in only
        ? [{ orgId: only.orgId, id: only.factoryProjectId }]
        : await options.projects.listAll();
    for (const project of projects) {
      byOrg.set(project.orgId, [...(byOrg.get(project.orgId) ?? []), project.id]);
    }

    for (const [orgId, projectIds] of byOrg) {
      let org: OrgIntakeListing<T> | null;
      try {
        org = await options.open(orgId, projectIds);
      } catch (error) {
        summary.failed += 1;
        summary.errors.push({ projectId: `org:${orgId}`, error: errorMessage(error) });
        continue;
      }

      for (const factoryProjectId of projectIds) {
        const scope = { orgId, factoryProjectId, kind };
        const sources = org?.sources(factoryProjectId) ?? new Map<string, Date>();
        let status: IntakePassStatus | null = null;
        try {
          status = await readIntakePassStatus(options.status, scope);
          // A project that never took records from this provider has nothing stored to clear.
          if (sources.size === 0 && !status) continue;
          const bindings = Object.fromEntries([...sources].map(([sourceId, bound]) => [sourceId, bound.toISOString()]));
          if (only && 'changedSources' in only && sameBindings(status?.imported ?? {}, bindings)) continue;
          summary.projects += 1;

          const boundAt = (sourceId: string) => bindings[sourceId];
          const imported = new Set<T>();
          const settlement = await openIntakeSettlement<T>({
            storage,
            orgId,
            factoryProjectId,
            integrationId,
            kind,
            record: options.record,
            itemKeys: options.itemKeys,
            cardKeys: options.cardKeys,
            refresh: options.refresh,
            eligible: item => {
              const sourceId = options.sourceId(item);
              const bound = sourceId ? sources.get(sourceId) : undefined;
              if (!sourceId || !bound) return false;
              const createdAt = options.record(item).createdAt;
              if (createdAt && createdAt.getTime() >= bound.getTime()) return true;
              if (!options.importsAtBind) return false;
              // Every open record of the source has been seen, so one that shows up now is new to
              // the listing whatever its age: it was reopened, or gained a label the project takes.
              if (status?.listed[sourceId] === boundAt(sourceId)) return true;
              return imported.has(item) && status?.imported[sourceId] !== boundAt(sourceId);
            },
            offer: fresh => options.offer({ orgId, factoryProjectId }, fresh),
          });

          let complete = sources.size === 0;
          let cursor: string | undefined;
          for (let page = 0; org && sources.size > 0 && page < INTAKE_PASS_MAX_PAGES; page += 1) {
            const listed = await org.list(factoryProjectId, [...sources.keys()], cursor);
            if (page < INTAKE_IMPORT_MAX_PAGES) for (const item of listed.items) imported.add(item);
            // Settled page by page: a record is stored moments after the provider said it is open,
            // not once every page after it has been read.
            await settlement.page(listed.items);
            if (listed.nextCursor === null) {
              complete = true;
              break;
            }
            cursor = listed.nextCursor;
          }
          const settled = await settlement.finish(complete);
          summary.offered += settled.offered;
          summary.stored += settled.stored;
          summary.removed += settled.removed;

          const at = now().toISOString();
          await saveIntakePassStatus(options.status, scope, {
            version: 1,
            completeAt: complete ? at : (status?.completeAt ?? null),
            failedAt: null,
            error: null,
            imported: bindings,
            listed: complete ? bindings : (status?.listed ?? {}),
          });
        } catch (error) {
          summary.failed += 1;
          summary.errors.push({ projectId: factoryProjectId, error: errorMessage(error) });
          await saveIntakePassStatus(options.status, scope, {
            ...(status ?? NO_STATUS),
            failedAt: now().toISOString(),
            error: errorMessage(error).slice(0, 500),
          }).catch(() => undefined);
        }
      }
    }
    return summary;
  };
}

/** An organization's selected sources of one provider and the projects they are bound to. */
export interface BoundIntakeSources {
  selectedIds: string[];
  bindings: IntakeSourceBinding[];
  /** The selected sources bound to a project, with when each was bound. */
  forProject(factoryProjectId: string): Map<string, Date>;
}

export async function boundIntakeSources(
  intake: Pick<IntakeStorage, 'ensureReady' | 'getConfig' | 'listBindings'>,
  orgId: string,
  integrationId: string,
): Promise<BoundIntakeSources> {
  await intake.ensureReady();
  const selection = (await intake.getConfig({ orgId, integrationIds: [integrationId] }))[integrationId];
  const selectedIds = selection?.enabled ? (selection.sourceIds ?? []) : [];
  const bindings = selectedIds.length > 0 ? await intake.listBindings({ orgId, integrationId }) : [];
  return {
    selectedIds,
    bindings,
    forProject: factoryProjectId =>
      new Map(
        bindings
          .filter(binding => binding.factoryProjectId === factoryProjectId && selectedIds.includes(binding.sourceId))
          .map(binding => [binding.sourceId, binding.createdAt]),
      ),
  };
}

/**
 * Hand records to the rules one at a time. Every one is tried, so a record the rules cannot take
 * does not hold back the rest; the first failure still fails the pass, and the next one offers the
 * same records again under the same delivery ids.
 */
export async function offerEach<T>(items: readonly T[], offer: (item: T) => Promise<unknown>): Promise<void> {
  const failures: unknown[] = [];
  for (const item of items) await offer(item).catch(error => failures.push(error));
  if (failures.length > 0) throw failures[0];
}

/** Run a provider's intake pass after its issue sweep, under the same lease and on the same timer. */
export function withIntakePass(
  reconcile: (() => Promise<IssueReconcileSummary>) | undefined,
  ...passes: (IntakePass | undefined)[]
): (() => Promise<IssueReconcileSummary>) | undefined {
  const attached = passes.filter(pass => pass !== undefined);
  if (attached.length === 0) return reconcile;
  return async () => {
    const swept: IssueReconcileSummary = reconcile
      ? await reconcile()
      : { projects: 0, checked: 0, updated: 0, closed: 0, missing: 0, failed: 0, errors: [] };
    const intake = await runIntakePasses(attached);
    return {
      ...swept,
      failed: swept.failed + intake.failed,
      errors: [...swept.errors, ...intake.errors],
      intake: { offered: intake.offered, stored: intake.stored, removed: intake.removed },
    };
  };
}

/** Run passes one after the other and add up what they did. */
export async function runIntakePasses(
  passes: readonly IntakePass[],
  only?: IntakePassScope,
): Promise<IntakePassSummary> {
  const total: IntakePassSummary = { projects: 0, offered: 0, stored: 0, removed: 0, failed: 0, errors: [] };
  for (const pass of passes) {
    const summary = await pass(only);
    total.projects = Math.max(total.projects, summary.projects);
    total.offered += summary.offered;
    total.stored += summary.stored;
    total.removed += summary.removed;
    total.failed += summary.failed;
    total.errors.push(...summary.errors);
  }
  return total;
}

/**
 * Run the passes for the project a repository was just linked to, so the records the link-time
 * import left without a card are offered straight away instead of at the next pass.
 */
export async function runIntakePassesForLink(
  passes: readonly IntakePass[],
  sourceControl: Pick<SourceControlStorageHandle, 'projectRepositories' | 'connections'>,
  link: { orgId: string; projectRepositoryId: string },
): Promise<void> {
  if (passes.length === 0) return;
  const linked = await sourceControl.projectRepositories.get({ orgId: link.orgId, id: link.projectRepositoryId });
  const connection = linked && (await sourceControl.connections.get({ orgId: link.orgId, id: linked.connectionId }));
  if (!connection) return;
  const summary = await runIntakePasses(passes, { orgId: link.orgId, factoryProjectId: connection.factoryProjectId });
  if (summary.failed > 0) throw new Error(summary.errors[0]?.error ?? 'The intake pass failed.');
}

/** A repository linked to a project, as a pass lists it. */
export interface LinkedIntakeRepository {
  /** The link's id, which the pass uses as the source id. */
  id: string;
  linkedAt: Date;
  repositoryId: string;
  /** The provider's id of the repository. */
  externalId: string;
  slug: string;
  /** The provider's id of the installation the repository is reached through. */
  installationExternalId: string;
  host: string | null;
}

/** The repositories linked to each of an organization's projects through one provider. */
export async function linkedIntakeRepositories(
  sourceControl: Pick<SourceControlStorageHandle, 'connections'>,
  orgId: string,
  factoryProjectIds: string[],
): Promise<Map<string, LinkedIntakeRepository[]>> {
  const byProject = new Map<string, LinkedIntakeRepository[]>();
  for (const connection of await sourceControl.connections.listWithRepositories({ orgId, factoryProjectIds })) {
    const host = connection.installation.providerMetadata.host;
    for (const link of connection.repositories) {
      if (!link.repository) continue;
      byProject.set(connection.factoryProjectId, [
        ...(byProject.get(connection.factoryProjectId) ?? []),
        {
          id: link.id,
          linkedAt: link.createdAt,
          repositoryId: link.repository.id,
          externalId: link.repository.externalId,
          slug: link.repository.slug,
          installationExternalId: connection.installation.externalId,
          host: typeof host === 'string' && host ? host : null,
        },
      ]);
    }
  }
  return byProject;
}

/**
 * List several sources as one paged listing: the cursor names the source being read and the
 * provider's own cursor within it.
 */
export async function listSourcesInTurn<S, T>(
  sources: readonly S[],
  cursor: string | undefined,
  list: (source: S, cursor: string | undefined) => Promise<{ items: T[]; nextCursor: string | null }>,
): Promise<{ items: T[]; nextCursor: string | null }> {
  const split = cursor?.indexOf(':') ?? -1;
  const index = cursor ? Number(cursor.slice(0, split)) : 0;
  const inner = cursor ? cursor.slice(split + 1) || undefined : undefined;
  const source = sources[index];
  if (source === undefined) return { items: [], nextCursor: null };
  const page = await list(source, inner);
  if (page.nextCursor !== null) return { items: page.items, nextCursor: `${index}:${page.nextCursor}` };
  return { items: page.items, nextCursor: index + 1 < sources.length ? `${index + 1}:` : null };
}
