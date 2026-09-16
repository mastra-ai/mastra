export interface IncidentioUser {
  id: string;
  name: string;
  email?: string;
  role?: string;
  slack_user_id?: string;
}

export interface IncidentioActor {
  alert?: { id: string; title: string };
  api_key?: { id: string; name: string };
  user?: IncidentioUser;
  workflow?: { id: string; name: string };
}

export interface IncidentioIncident {
  id: string;
  reference: string;
  name: string;
  summary?: string;
  permalink?: string;
  visibility: string;
  mode: string;
  creator: IncidentioActor;
  incident_status: { id: string; name: string; category: string };
  incident_type?: { id: string; name: string };
  severity?: { id: string; name: string; rank: number };
  slack_channel_url?: string;
  postmortem_document_url?: string;
  created_at: string;
  updated_at: string;
}

export interface IncidentioFollowUp {
  id: string;
  incident_id: string;
  title: string;
  description?: string;
  status: 'outstanding' | 'completed' | 'deleted' | 'not_doing';
  creator: IncidentioActor;
  assignee?: IncidentioUser | null;
  assignee_team?: { id: string; name: string } | null;
  labels: string[];
  priority?: { id: string; name: string; rank: number } | null;
  category?: { id: string; name: string } | null;
  external_issue_reference?: { issue_name: string; issue_permalink: string; provider: string } | null;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface IncidentioAction {
  id: string;
  incident_id: string;
  description: string;
  status: 'outstanding' | 'completed' | 'deleted' | 'not_doing';
  creator: IncidentioActor;
  assignee?: IncidentioUser;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface IncidentioIncidentUpdate {
  id: string;
  incident_id: string;
  updater: IncidentioActor;
  new_incident_status: { id: string; name: string; category: string };
  message?: string;
  merged_into_incident_id?: string;
  new_severity?: { id: string; name: string; rank: number };
  created_at: string;
}

export interface IncidentioAlertAttributeValue {
  catalog_entry?: { id: string; name: string; catalog_type_id?: string };
  label?: string;
  literal?: string;
}

export interface IncidentioAlertAttributeEntry {
  attribute: {
    id: string;
    name: string;
    type: string;
    array: boolean;
    required: boolean;
    emoji?: string;
  };
  value?: IncidentioAlertAttributeValue;
  array_value?: IncidentioAlertAttributeValue[];
}

export interface IncidentioAlert {
  id: string;
  alert_source_id: string;
  deduplication_key: string;
  status: 'firing' | 'resolved';
  title: string;
  attributes: IncidentioAlertAttributeEntry[];
  alert_group_ids?: string[];
  description?: string;
  resolved_at?: string;
  source_url?: string;
  created_at: string;
  updated_at: string;
}

export interface IncidentioEscalation {
  id: string;
  status:
    | 'pending'
    | 'triggered'
    | 'acked'
    | 'resolved'
    | 'expired'
    | 'cancelled'
    | 'snoozed'
    | 'delayed'
    | 'pending_repeat';
  title: string;
  description: string;
  priority: { name: string };
  creator: IncidentioActor;
  escalation_path_id?: string;
  events: Array<{
    id: string;
    event:
      | 'entered_grace_period'
      | 'triggered'
      | 'notified_users'
      | 'notified_channels'
      | 'acked'
      | 'cancelled'
      | 'resolved'
      | 'expired';
    occurred_at: string;
    urgency?: 'high' | 'low';
    users?: IncidentioUser[];
    channels?: Array<{
      microsoft_teams_channel_id?: string;
      microsoft_teams_team_id?: string;
      slack_channel_id?: string;
      slack_team_id?: string;
    }>;
  }>;
  related_incidents: Array<{
    id: string;
    external_id: number;
    name: string;
    reference: string;
    visibility: 'public' | 'private';
    status_category: string;
    summary?: string;
  }>;
  related_alerts: Array<{
    id: string;
    alert_source_id: string;
    deduplication_key: string;
    status: 'firing' | 'resolved';
    title: string;
    alert_group_ids?: string[];
    description?: string;
    resolved_at?: string;
    source_url?: string;
    created_at: string;
    updated_at: string;
  }>;
  created_at: string;
  updated_at: string;
}

export interface IncidentioCatalogEntry {
  id: string;
  catalog_type_id: string;
  name: string;
  aliases: string[];
  rank: number;
  attribute_values: Record<
    string,
    {
      value?: { label: string; literal?: string };
      array_value?: Array<{ label: string; literal?: string }>;
    }
  >;
  external_id?: string;
  archived_at?: string;
  created_at: string;
  updated_at: string;
}

export interface IncidentioCatalogType {
  id: string;
  name: string;
  description: string;
  type_name: string;
  ranked: boolean;
  is_editable: boolean;
  use_name_as_identifier: boolean;
  categories: string[];
  annotations: Record<string, string>;
  color: string;
  icon: string;
  created_at: string;
  updated_at: string;
}

export interface IncidentioCatalogResource {
  type: string;
  engine_resource_type: string;
  label: string;
  description: string;
  value_docstring: string;
  category: string;
}

export interface IncidentioTeam {
  id: string;
  name: string;
  catalog_entry: { id: string; name: string; external_id?: string };
  members: IncidentioUser[];
}

export interface IncidentioSchedule {
  id: string;
  name: string;
  timezone: string;
  team_ids: string[];
  permalink: string;
  annotations: Record<string, string>;
  config?: {
    rotations: Array<{
      id: string;
      name: string;
      users: IncidentioUser[];
      handover_start_at: string;
      scheduling_mode?: 'fair' | 'sequential';
    }>;
  };
  current_shifts?: IncidentioScheduleEntry[];
  next_shifts?: IncidentioScheduleEntry[];
  holidays_public_config?: { country_codes: string[] };
  created_at: string;
  updated_at: string;
}

export interface IncidentioScheduleEntry {
  start_at: string;
  end_at: string;
  entry_id?: string;
  fingerprint?: string;
  layer_id?: string;
  rotation_id?: string;
  user?: IncidentioUser;
}

export interface IncidentioPolicyFinding {
  id: string;
  policy_id: string;
  policy_type: 'debrief' | 'follow_up' | 'on_call_readiness' | 'post_mortem' | 'schedule' | 'vacation_conflict';
  state: 'pending' | 'active' | 'resolved' | 'cancelled' | 'dismissed';
  responsible_users: IncidentioUser[];
  days?: number;
  due_at?: string;
  debrief?: { incident_id: string };
  dismissal?: { dismissed_at: string; dismissed_by: IncidentioActor; reason: string };
  follow_up?: { incident_id: string; follow_up_id: string };
  on_call_readiness?: {
    user_id: string;
    high_urgency: IncidentioReadinessRule[];
    low_urgency: IncidentioReadinessRule[];
  };
  post_mortem?: { incident_id: string };
  schedule?: {
    schedule_id: string;
    start_at: string;
    end_at: string;
    cause?: 'nobody_scheduled' | 'no_on_call_seat' | 'user_deactivated';
    has_unscheduled_time?: boolean;
    rotation_id?: string;
  };
  vacation_conflict?: {
    user_id: string;
    schedule_id: string;
    start_at: string;
    end_at: string;
    holiday_name?: string;
    rotation_id?: string;
  };
  last_checked_at: string;
  created_at: string;
  updated_at: string;
}

export interface IncidentioReadinessRule {
  method_types: string[];
  met: boolean;
  max_delay_seconds?: number;
}

export interface IncidentioPage<T> {
  items: T[];
  nextCursor: string | null;
  total?: number;
}

export interface IncidentioCatalogEntryPage extends IncidentioPage<IncidentioCatalogEntry> {
  catalogType: IncidentioCatalogType;
}

export interface IncidentioCatalogEntryResult {
  entry: IncidentioCatalogEntry;
  catalogType: IncidentioCatalogType;
}

export interface IncidentioListOptions {
  cursor?: string;
  pageSize?: number;
}

export interface IncidentioListActionsOptions extends IncidentioListOptions {
  incidentId?: string;
  incidentMode?: string;
}

export interface IncidentioListIncidentUpdatesOptions extends IncidentioListOptions {
  incidentId?: string;
}

export interface IncidentioListPolicyFindingsOptions extends IncidentioListOptions {
  policyId?: string;
}

export class IncidentioApiError extends Error {
  readonly status: number | null;

  constructor(message: string, status: number | null) {
    super(message);
    this.name = 'IncidentioApiError';
    this.status = status;
  }
}

export interface IncidentioApiClientConfig {
  baseUrl: string;
  accessToken: string;
  fetchImpl?: typeof fetch;
}

interface IncidentioPaginationMeta {
  after?: string | null;
  total_record_count?: number;
}

export class IncidentioApiClient {
  readonly #baseUrl: string;
  readonly #accessToken: string;
  readonly #fetch: typeof fetch;

  constructor(config: IncidentioApiClientConfig) {
    const baseUrl = config.baseUrl.trim();
    const accessToken = config.accessToken.trim();
    if (!baseUrl || !accessToken) {
      throw new Error('IncidentioApiClient requires a base URL and access token.');
    }
    this.#baseUrl = baseUrl.replace(/\/+$/, '');
    this.#accessToken = accessToken;
    this.#fetch = config.fetchImpl ?? globalThis.fetch;
  }

  async listIncidents(cursor?: string): Promise<IncidentioPage<IncidentioIncident>> {
    const result = await this.#request<{
      incidents: IncidentioIncident[];
      pagination_meta?: IncidentioPaginationMeta;
    }>('GET', '/v2/incidents', {
      query: { page_size: 100, after: cursor, sort_by: 'created_at_newest_first' },
    });
    return this.#page(result.incidents, result.pagination_meta);
  }

  async getIncident(id: string): Promise<IncidentioIncident> {
    const result = await this.#request<{ incident: IncidentioIncident }>(
      'GET',
      `/v2/incidents/${encodeURIComponent(id)}`,
    );
    return result.incident;
  }

  async listFollowUps(cursor?: string): Promise<IncidentioPage<IncidentioFollowUp>> {
    const result = await this.#request<{
      follow_ups: IncidentioFollowUp[];
      pagination_meta: IncidentioPaginationMeta;
    }>('GET', '/v3/follow_ups', { query: { page_size: 100, after: cursor } });
    return this.#page(result.follow_ups, result.pagination_meta);
  }

  async getFollowUp(id: string): Promise<IncidentioFollowUp> {
    const result = await this.#request<{ follow_up: IncidentioFollowUp }>(
      'GET',
      `/v3/follow_ups/${encodeURIComponent(id)}`,
    );
    return result.follow_up;
  }

  async updateFollowUp(followUp: IncidentioFollowUp, status: IncidentioFollowUp['status']): Promise<IncidentioFollowUp> {
    const result = await this.#request<{ follow_up: IncidentioFollowUp }>(
      'PUT',
      `/v3/follow_ups/${encodeURIComponent(followUp.id)}`,
      { body: { title: followUp.title, status } },
    );
    return result.follow_up;
  }

  async listActions(options: IncidentioListActionsOptions = {}): Promise<IncidentioPage<IncidentioAction>> {
    const result = await this.#request<{
      actions: IncidentioAction[];
      pagination_meta: IncidentioPaginationMeta;
    }>('GET', '/v3/actions', {
      query: {
        page_size: options.pageSize ?? 100,
        after: options.cursor,
        incident_id: options.incidentId,
        incident_mode: options.incidentMode,
      },
    });
    return this.#page(result.actions, result.pagination_meta);
  }

  async getAction(id: string): Promise<IncidentioAction> {
    const result = await this.#request<{ action: IncidentioAction }>('GET', `/v3/actions/${encodeURIComponent(id)}`);
    return result.action;
  }

  async listIncidentUpdates(
    options: IncidentioListIncidentUpdatesOptions = {},
  ): Promise<IncidentioPage<IncidentioIncidentUpdate>> {
    const result = await this.#request<{
      incident_updates: IncidentioIncidentUpdate[];
      pagination_meta?: IncidentioPaginationMeta;
    }>('GET', '/v2/incident_updates', {
      query: { page_size: options.pageSize ?? 100, after: options.cursor, incident_id: options.incidentId },
    });
    return this.#page(result.incident_updates, result.pagination_meta);
  }

  async listAlerts(options: IncidentioListOptions = {}): Promise<IncidentioPage<IncidentioAlert>> {
    const result = await this.#request<{ alerts: IncidentioAlert[]; pagination_meta: IncidentioPaginationMeta }>(
      'GET',
      '/v2/alerts',
      { query: { page_size: options.pageSize ?? 50, after: options.cursor } },
    );
    return this.#page(result.alerts, result.pagination_meta);
  }

  async getAlert(id: string): Promise<IncidentioAlert> {
    const result = await this.#request<{ alert: IncidentioAlert }>('GET', `/v2/alerts/${encodeURIComponent(id)}`);
    return result.alert;
  }

  async listEscalations(options: IncidentioListOptions = {}): Promise<IncidentioPage<IncidentioEscalation>> {
    const result = await this.#request<{
      escalations: IncidentioEscalation[];
      pagination_meta: IncidentioPaginationMeta;
    }>('GET', '/v2/escalations', {
      query: { page_size: options.pageSize ?? 50, after: options.cursor },
    });
    return this.#page(result.escalations, result.pagination_meta);
  }

  async getEscalation(id: string): Promise<IncidentioEscalation> {
    const result = await this.#request<{ escalation: IncidentioEscalation }>(
      'GET',
      `/v2/escalations/${encodeURIComponent(id)}`,
    );
    return result.escalation;
  }

  async listCatalogEntries(
    catalogTypeId: string,
    options: IncidentioListOptions & { identifier?: string } = {},
  ): Promise<IncidentioCatalogEntryPage> {
    const result = await this.#request<{
      catalog_entries: IncidentioCatalogEntry[];
      catalog_type: IncidentioCatalogType;
      pagination_meta: IncidentioPaginationMeta;
    }>('GET', '/v3/catalog_entries', {
      query: {
        catalog_type_id: catalogTypeId,
        page_size: options.pageSize ?? 100,
        after: options.cursor,
        identifier: options.identifier,
      },
    });
    return { ...this.#page(result.catalog_entries, result.pagination_meta), catalogType: result.catalog_type };
  }

  async getCatalogEntry(id: string, options: { expand?: boolean } = {}): Promise<IncidentioCatalogEntryResult> {
    const result = await this.#request<{
      catalog_entry: IncidentioCatalogEntry;
      catalog_type: IncidentioCatalogType;
    }>('GET', `/v3/catalog_entries/${encodeURIComponent(id)}`, { query: { expand: options.expand } });
    return { entry: result.catalog_entry, catalogType: result.catalog_type };
  }

  async listCatalogTypes(): Promise<IncidentioCatalogType[]> {
    const result = await this.#request<{ catalog_types: IncidentioCatalogType[] }>('GET', '/v3/catalog_types');
    return result.catalog_types;
  }

  async getCatalogType(id: string): Promise<IncidentioCatalogType> {
    const result = await this.#request<{ catalog_type: IncidentioCatalogType }>(
      'GET',
      `/v3/catalog_types/${encodeURIComponent(id)}`,
    );
    return result.catalog_type;
  }

  async listCatalogResources(): Promise<IncidentioCatalogResource[]> {
    const result = await this.#request<{ resources: IncidentioCatalogResource[] }>('GET', '/v3/catalog_resources');
    return result.resources;
  }

  async listTeams(options: IncidentioListOptions = {}): Promise<IncidentioPage<IncidentioTeam>> {
    const result = await this.#request<{ teams: IncidentioTeam[]; pagination_meta: IncidentioPaginationMeta }>(
      'GET',
      '/v3/teams',
      { query: { page_size: options.pageSize ?? 100, after: options.cursor } },
    );
    return this.#page(result.teams, result.pagination_meta);
  }

  async getTeam(id: string): Promise<IncidentioTeam> {
    const result = await this.#request<{ team: IncidentioTeam }>('GET', `/v3/teams/${encodeURIComponent(id)}`);
    return result.team;
  }

  async listSchedules(options: IncidentioListOptions = {}): Promise<IncidentioPage<IncidentioSchedule>> {
    const result = await this.#request<{
      schedules: IncidentioSchedule[];
      pagination_meta?: IncidentioPaginationMeta;
    }>('GET', '/v2/schedules', {
      query: { page_size: options.pageSize ?? 25, after: options.cursor },
    });
    return this.#page(result.schedules, result.pagination_meta);
  }

  async getSchedule(id: string): Promise<IncidentioSchedule> {
    const result = await this.#request<{ schedule: IncidentioSchedule }>(
      'GET',
      `/v2/schedules/${encodeURIComponent(id)}`,
    );
    return result.schedule;
  }

  async listPolicyFindings(
    options: IncidentioListPolicyFindingsOptions = {},
  ): Promise<IncidentioPage<IncidentioPolicyFinding>> {
    const result = await this.#request<{
      policy_findings: IncidentioPolicyFinding[];
      pagination_meta: IncidentioPaginationMeta;
    }>('GET', '/v2/policy_findings', {
      query: { page_size: options.pageSize ?? 100, after: options.cursor, policy_id: options.policyId },
    });
    return this.#page(result.policy_findings, result.pagination_meta);
  }

  async getPolicyFinding(id: string): Promise<IncidentioPolicyFinding> {
    const result = await this.#request<{ policy_finding: IncidentioPolicyFinding }>(
      'GET',
      `/v2/policy_findings/${encodeURIComponent(id)}`,
    );
    return result.policy_finding;
  }

  #page<T>(items: T[], paginationMeta?: IncidentioPaginationMeta): IncidentioPage<T> {
    return {
      items,
      nextCursor: paginationMeta?.after ?? null,
      ...(paginationMeta?.total_record_count === undefined ? {} : { total: paginationMeta.total_record_count }),
    };
  }

  async #request<T>(
    method: 'GET' | 'PUT',
    path: string,
    options: { query?: Record<string, string | number | boolean | undefined>; body?: unknown } = {},
  ): Promise<T> {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(options.query ?? {})) {
      if (value !== undefined) query.set(key, String(value));
    }

    let response: Response;
    try {
      response = await this.#fetch(`${this.#baseUrl}${path}${query.size > 0 ? `?${query.toString()}` : ''}`, {
        method,
        signal: AbortSignal.timeout(15_000),
        headers: {
          accept: 'application/json',
          authorization: `Bearer ${this.#accessToken}`,
          ...(options.body === undefined ? {} : { 'content-type': 'application/json' }),
        },
        ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes(this.#accessToken)) {
        const redacted = new Error(error.message.replaceAll(this.#accessToken, '[REDACTED]'));
        redacted.name = error.name;
        throw redacted;
      }
      throw error;
    }

    if (!response.ok) {
      let detail = `incident.io API request failed (${response.status})`;
      try {
        const body = (await response.clone().json()) as { message?: string; error?: string; detail?: string };
        detail = body.message ?? body.error ?? body.detail ?? detail;
      } catch {
        // Use the status-based message.
      }
      throw new IncidentioApiError(detail.replaceAll(this.#accessToken, '[REDACTED]'), response.status);
    }
    return (await response.json()) as T;
  }
}
