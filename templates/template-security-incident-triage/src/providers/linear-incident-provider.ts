import { resolveLinearWorkflowMapping } from './linear-workflow-mapping.js';
import { LinearClient } from '@linear/sdk';
import { createHash } from 'node:crypto';

import { DomainError } from '../domain/errors.js';
import type { ExternalIncidentProjection, ExternalIncidentResult, IncidentProvider } from './incident-provider.js';

type LinearIssuePayload = Readonly<{
  success?: boolean;
  issueId?: string;
  issue?: Readonly<{ id?: string }>;
}>;
export class AmbiguousLinearCreateError extends Error {}
export class AmbiguousLinearUpdateError extends Error {}
export type LinearIssueClient = Readonly<{
  createIssue(
    input: Readonly<{
      teamId: string;
      title: string;
      description: string;
      projectId?: string;
      labelIds?: readonly string[];
      priority?: number;
      stateId?: string;
    }>,
  ): Promise<LinearIssuePayload>;
  updateIssue(
    id: string,
    input: Readonly<{
      title: string;
      description: string;
      labelIds?: readonly string[];
      priority?: number;
      stateId?: string;
    }>,
  ): Promise<LinearIssuePayload>;
  searchIssues(
    term: string,
    input: Readonly<{ teamId: string }>,
  ): Promise<Readonly<{ nodes?: readonly Readonly<{ id?: string }>[] }>>;
  issue?(id: string): Promise<
    Readonly<{
      id?: string;
      title?: string;
      state?: Readonly<{ id?: string }>;
      team?: Readonly<{ id?: string }>;
      project?: Readonly<{ id?: string }>;
    }>
  >;
}>;

/**
 * The API key can see more than the approved destination.  Resolve the
 * workspace/team/project relationship before the first write and keep that
 * successful binding for this provider instance.  This deliberately makes a
 * missing resolver fail closed instead of treating IDs in environment
 * variables as authority.
 */
export type LinearDestinationResolver = () => Promise<
  Readonly<{ workspaceId: string; teamId: string; projectId?: string }>
>;

/** Minimal, redacted Linear projection. The local delivery ledger owns idempotency. */
export class LinearIncidentProvider implements IncidentProvider {
  readonly providerId = 'linear' as const;
  private readonly inFlight = new Map<string, Promise<ExternalIncidentResult>>();
  // This is only a process-local backstop. The durable delivery ledger is the
  // authority across restarts/workers, but an SDK call already in this
  // instance must not let an older response overwrite a newer generation.
  private readonly incidentTails = new Map<string, Promise<unknown>>();
  private readonly deliveredGeneration = new Map<string, number>();
  constructor(
    private readonly options: Readonly<{
      client: LinearIssueClient;
      workspaceId: string;
      teamId: string;
      projectId?: string;
      severityLabelIds: Readonly<Partial<Record<'low' | 'medium' | 'high' | 'critical', string>>>;
      statusStateIds: Readonly<Record<string, string>>;
      internalBaseUrl: string;
      resolveDestination: LinearDestinationResolver;
    }>,
  ) {}
  private binding: Promise<void> | undefined;
  async create(input: {
    projection: ExternalIncidentProjection;
    idempotencyKey: string;
    generation: number;
  }): Promise<ExternalIncidentResult> {
    return this.serializeIncident(input.projection, () =>
      this.singleFlight('create', input, () => this.createOnce(input)),
    );
  }
  private async createOnce(input: {
    projection: ExternalIncidentProjection;
    idempotencyKey: string;
    generation: number;
  }): Promise<ExternalIncidentResult> {
    this.assertFreshGeneration(input.projection, input.generation);
    await this.assertDestination();
    const projection = input.projection;
    const marker = deliveryMarker(input.idempotencyKey, input.generation);
    const existing = await this.findExisting(marker, projection);
    if (existing) return this.rememberGeneration(input.projection, input.generation, existing);
    const payload = toLinearPayload(projection, this.options, marker);
    try {
      const result = await this.options.client.createIssue({
        teamId: this.options.teamId,
        ...payload,
        ...(this.options.projectId ? { projectId: this.options.projectId } : {}),
      });
      const created = parseResult(result);
      const verified = await this.readback(created.externalRef, marker, projection);
      if (!verified) throw new AmbiguousLinearCreateError();
      return this.rememberGeneration(input.projection, input.generation, verified);
    } catch {
      // Create may have committed remotely before its response was lost. A
      // marker search is the reconciliation boundary before any retry.
      const reconciled = await this.findExisting(marker, projection);
      if (reconciled) return this.rememberGeneration(input.projection, input.generation, reconciled);
      throw new AmbiguousLinearCreateError();
    }
  }
  async update(input: {
    externalRef: string;
    projection: ExternalIncidentProjection;
    idempotencyKey: string;
    generation: number;
  }): Promise<ExternalIncidentResult> {
    return this.serializeIncident(input.projection, () =>
      this.singleFlight('update', input, () => this.updateOnce(input)),
    );
  }
  private async updateOnce(input: {
    externalRef: string;
    projection: ExternalIncidentProjection;
    idempotencyKey: string;
    generation: number;
  }): Promise<ExternalIncidentResult> {
    this.assertFreshGeneration(input.projection, input.generation);
    await this.assertDestination();
    if (!/^linear:[A-Za-z0-9_-]{1,120}$/u.test(input.externalRef)) throw new DomainError('VALIDATION_FAILED');
    const issueId = input.externalRef.slice('linear:'.length);
    try {
      const result = await this.options.client.updateIssue(
        issueId,
        toLinearPayload(input.projection, this.options, deliveryMarker(input.idempotencyKey, input.generation)),
      );
      const parsed = parseResult(result);
      if (parsed.externalRef !== input.externalRef) throw new DomainError('CONFLICT');
      // A nominal SDK response is not authoritative evidence: Linear may
      // accept an update while exposing a stale state/destination. Re-read
      // the exact issue before declaring this generation delivered.
      const verified = await this.readback(
        parsed.externalRef,
        deliveryMarker(input.idempotencyKey, input.generation),
        input.projection,
      );
      if (!verified) throw new AmbiguousLinearUpdateError();
      return this.rememberGeneration(input.projection, input.generation, verified);
    } catch {
      const reconciled = await this.reconcile({
        operation: 'update',
        idempotencyKey: input.idempotencyKey,
        externalRef: input.externalRef,
        generation: input.generation,
        projection: input.projection,
      });
      if (reconciled) return this.rememberGeneration(input.projection, input.generation, reconciled);
      throw new AmbiguousLinearUpdateError();
    }
  }
  private singleFlight(
    operation: 'create' | 'update',
    input: Readonly<{ idempotencyKey: string; generation: number }>,
    execute: () => Promise<ExternalIncidentResult>,
  ): Promise<ExternalIncidentResult> {
    const key = `${operation}\u0000${input.idempotencyKey}\u0000${input.generation}`;
    const existing = this.inFlight.get(key);
    if (existing) return existing;
    const pending = execute().finally(() => this.inFlight.delete(key));
    this.inFlight.set(key, pending);
    return pending;
  }
  private serializeIncident<T>(projection: ExternalIncidentProjection, execute: () => Promise<T>): Promise<T> {
    const key = `${projection.tenantId}\u0000${projection.incidentId}`;
    const previous = this.incidentTails.get(key) ?? Promise.resolve();
    const pending = previous.catch(() => undefined).then(execute);
    // Keep a rejection-neutral tail, so a transient old request cannot block
    // the next generation forever. Delete only if this is still the tail.
    const tail = pending.catch(() => undefined);
    this.incidentTails.set(key, tail);
    void tail.finally(() => {
      if (this.incidentTails.get(key) === tail) this.incidentTails.delete(key);
    });
    return pending;
  }
  private assertFreshGeneration(projection: ExternalIncidentProjection, generation: number): void {
    const current = this.deliveredGeneration.get(`${projection.tenantId}\u0000${projection.incidentId}`);
    if (current !== undefined && generation < current) throw new DomainError('CONFLICT');
  }
  private rememberGeneration(
    projection: ExternalIncidentProjection,
    generation: number,
    result: ExternalIncidentResult,
  ): ExternalIncidentResult {
    const key = `${projection.tenantId}\u0000${projection.incidentId}`;
    this.deliveredGeneration.set(key, Math.max(this.deliveredGeneration.get(key) ?? 0, generation));
    return result;
  }
  async reconcile(input: {
    operation: 'create' | 'update';
    idempotencyKey: string;
    externalRef?: string;
    generation?: number;
    projection?: ExternalIncidentProjection;
  }): Promise<ExternalIncidentResult | undefined> {
    await this.assertDestination();
    if (input.operation === 'update') {
      if (!input.externalRef) return undefined;
      if (!/^linear:[A-Za-z0-9_-]{1,120}$/u.test(input.externalRef)) throw new DomainError('VALIDATION_FAILED');
      const issueId = input.externalRef.slice('linear:'.length);
      const readback = await this.options.client.issue?.(issueId);
      const marker = deliveryMarker(input.idempotencyKey, input.generation);
      const expectedStateId = input.projection ? this.options.statusStateIds[input.projection.status] : undefined;
      if (
        !readback ||
        readback.id !== issueId ||
        !readback.title?.includes(marker) ||
        (expectedStateId !== undefined && readback.state?.id !== expectedStateId) ||
        readback.team?.id !== this.options.teamId ||
        (this.options.projectId !== undefined && readback.project?.id !== this.options.projectId)
      )
        return undefined;
      return { externalRef: input.externalRef };
    }
    await this.assertDestination();
    if (!input.projection || input.generation === undefined) return undefined;
    return this.findExisting(deliveryMarker(input.idempotencyKey, input.generation), input.projection);
  }
  private async findExisting(
    marker: string,
    projection: ExternalIncidentProjection,
  ): Promise<ExternalIncidentResult | undefined> {
    const found = await this.options.client.searchIssues(marker, {
      teamId: this.options.teamId,
    });
    const id = found.nodes?.[0]?.id;
    return typeof id === 'string' ? this.readback(`linear:${id}`, marker, projection) : undefined;
  }
  private async readback(
    externalRef: string,
    marker: string,
    projection: ExternalIncidentProjection,
  ): Promise<ExternalIncidentResult | undefined> {
    const issueId = externalRef.slice('linear:'.length);
    const readback = await this.options.client.issue?.(issueId);
    const expectedStateId = this.options.statusStateIds[projection.status];
    if (
      !readback ||
      readback.id !== issueId ||
      !readback.title?.includes(marker) ||
      (expectedStateId !== undefined && readback.state?.id !== expectedStateId) ||
      readback.team?.id !== this.options.teamId ||
      (this.options.projectId !== undefined && readback.project?.id !== this.options.projectId)
    )
      return undefined;
    return { externalRef };
  }
  private async assertDestination(): Promise<void> {
    const pending =
      this.binding ??
      this.options.resolveDestination().then(actual => {
        if (
          actual.workspaceId !== this.options.workspaceId ||
          actual.teamId !== this.options.teamId ||
          actual.projectId !== this.options.projectId
        )
          throw new DomainError('VALIDATION_FAILED');
      });
    this.binding = pending;
    try {
      await pending;
    } catch (error) {
      // Only successful validation is cacheable. Preserve an in-flight newer
      // resolution if one was installed while this failed.
      if (this.binding === pending) this.binding = undefined;
      throw error;
    }
  }
}

export function createLinearIncidentProvider(
  input: Readonly<{
    apiKey: string;
    workspaceId: string;
    teamId: string;
    projectId?: string;
    severityLabelIds: Readonly<Partial<Record<'low' | 'medium' | 'high' | 'critical', string>>>;
    statusStateIds: Readonly<Record<string, string>>;
    severityLabelNames?: Readonly<Record<string, string>>;
    statusStateNames?: Readonly<Record<string, string>>;
    internalBaseUrl: string;
  }>,
): LinearIncidentProvider {
  const client = new LinearClient({ apiKey: input.apiKey });
  const severityLabelIds = { ...input.severityLabelIds };
  const statusStateIds = { ...input.statusStateIds };
  return new LinearIncidentProvider({
    ...input,
    severityLabelIds,
    statusStateIds,
    client: {
      createIssue: async payload => {
        const response = await client.createIssue({
          ...payload,
          labelIds: payload.labelIds ? [...payload.labelIds] : undefined,
        });
        const issue = response.issue ? await response.issue : undefined;
        return {
          success: response.success,
          ...(issue ? { issue: { id: issue.id } } : {}),
        };
      },
      updateIssue: async (id, payload) => {
        const response = await client.updateIssue(id, {
          ...payload,
          labelIds: payload.labelIds ? [...payload.labelIds] : undefined,
        });
        const issue = response.issue ? await response.issue : undefined;
        return {
          success: response.success,
          ...(issue ? { issue: { id: issue.id } } : {}),
        };
      },
      searchIssues: async (term, payload) => {
        const response = await client.searchIssues(term, payload);
        return { nodes: response.nodes.map(issue => ({ id: issue.id })) };
      },
      issue: async id => {
        const issue = await client.issue(id);
        const [state, team, project] = await Promise.all([issue.state, issue.team, issue.project]);
        return {
          id: issue.id,
          title: issue.title,
          ...(state ? { state: { id: state.id } } : {}),
          ...(team ? { team: { id: team.id } } : {}),
          ...(project ? { project: { id: project.id } } : {}),
        };
      },
    },
    resolveDestination: async () => {
      const [workspace, team, project] = await Promise.all([
        client.organization,
        client.team(input.teamId),
        input.projectId ? client.project(input.projectId) : undefined,
      ]);
      const teamWorkspace = await team.organization;
      const projectTeams = project ? await project.teams() : undefined;
      if (
        workspace.id !== input.workspaceId ||
        teamWorkspace.id !== input.workspaceId ||
        (input.projectId && (!project || !projectTeams?.nodes?.some(candidate => candidate.id === input.teamId)))
      )
        throw new DomainError('VALIDATION_FAILED');
      const states = [];
      let stateCursor: string | undefined;
      do {
        const page = await team.states({ first: 100, after: stateCursor });
        states.push(
          ...page.nodes.map(state => ({
            id: state.id,
            name: state.name,
            type: state.type,
            position: state.position,
          })),
        );
        stateCursor = page.pageInfo.hasNextPage ? (page.pageInfo.endCursor ?? undefined) : undefined;
      } while (stateCursor);
      const labels = [];
      let labelCursor: string | undefined;
      do {
        const page = await client.issueLabels({
          first: 100,
          after: labelCursor,
        });
        labels.push(
          ...(await Promise.all(
            page.nodes
              .filter(label => !label.isGroup)
              .map(async label => {
                const owner = await label.team;
                return {
                  id: label.id,
                  name: label.name,
                  ...(owner ? { teamId: owner.id } : {}),
                };
              }),
          )),
        );
        labelCursor = page.pageInfo.hasNextPage ? (page.pageInfo.endCursor ?? undefined) : undefined;
      } while (labelCursor);
      const mapping = resolveLinearWorkflowMapping({
        ...input,
        states,
        labels,
      });
      Object.assign(severityLabelIds, mapping.severityLabelIds);
      Object.assign(statusStateIds, mapping.statusStateIds);
      return {
        workspaceId: workspace.id,
        teamId: team.id,
        ...(project ? { projectId: project.id } : {}),
      };
    },
  });
}

function toLinearPayload(
  projection: ExternalIncidentProjection,
  options: ConstructorParameters<typeof LinearIncidentProvider>[0],
  marker?: string,
) {
  const stateId = options.statusStateIds[projection.status];
  const base = new URL(options.internalBaseUrl);
  base.pathname = `${base.pathname.replace(/\/+$/u, '')}/`;
  const link = new URL(`incidents/${encodeURIComponent(projection.incidentId)}`, base).toString();
  return {
    title: `[Security] ${projection.summaryCode} (${projection.incidentId})${marker ? ` [${marker}]` : ''}`,
    description: `Incident: ${projection.incidentId}\nSeverity: ${projection.severity}\nStatus: ${projection.status}\nDecision: ${projection.summaryCode}\nOccurred: ${projection.occurredAt}\nActions: ${projection.actionTypes.join(',')}\nInternal: ${link}`,
    ...(options.severityLabelIds[projection.severity]
      ? { labelIds: [options.severityLabelIds[projection.severity]!] }
      : {}),
    priority: { critical: 1, high: 2, medium: 3, low: 4 }[projection.severity],
    ...(stateId ? { stateId } : {}),
  };
}
function deliveryMarker(key: string, generation?: number): string {
  return `delivery-${createHash('sha256').update(key).digest('hex').slice(0, 24)}${generation ? `-g${generation}` : ''}`;
}
function parseResult(value: LinearIssuePayload): ExternalIncidentResult {
  const id = value.success === true ? (value.issueId ?? value.issue?.id) : undefined;
  if (typeof id !== 'string') throw new DomainError('STORAGE_UNAVAILABLE', { retryable: true });
  // Linear IDs are opaque strings; prefix them locally so the persisted
  // reference has a closed grammar and can never be mistaken for a URL.
  if (!/^[A-Za-z0-9_-]{1,120}$/u.test(id)) throw new DomainError('VALIDATION_FAILED');
  return { externalRef: `linear:${id}` };
}
