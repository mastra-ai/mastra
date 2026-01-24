import type {
  Team,
  TeamMember,
  TeamInvite,
  Project,
  Deployment,
  Build,
  RunningServer,
  ProjectSource,
  EncryptedEnvVar,
  User,
  TeamSettings,
  TeamRole,
  ProjectApiToken,
  HealthStatus,
  Trace,
  Span,
  Log,
  Score,
  PaginatedResponse,
  CreateProjectInput,
  CreateDeploymentInput,
  TraceQueryParams,
  LogQueryParams,
  MetricQueryParams,
  ScoreQueryParams,
  ServerHealthDetails,
  ServerMetrics,
  AggregatedMetrics,
} from '@/types/api';

export interface AdminClientConfig {
  baseUrl: string;
  getToken: () => Promise<string | null>;
}

export interface AdminClientError {
  error: string;
  code?: string;
  details?: Record<string, unknown>;
  requestId?: string;
}

export class AdminApiError extends Error {
  code?: string;
  details?: Record<string, unknown>;
  requestId?: string;
  statusCode: number;

  constructor(error: AdminClientError, statusCode: number) {
    super(error.error);
    this.name = 'AdminApiError';
    this.code = error.code;
    this.details = error.details;
    this.requestId = error.requestId;
    this.statusCode = statusCode;
  }
}

export class AdminClient {
  private baseUrl: string;
  private getToken: () => Promise<string | null>;

  constructor(config: AdminClientConfig) {
    this.baseUrl = config.baseUrl;
    this.getToken = config.getToken;
  }

  private async request<T>(
    method: string,
    path: string,
    options?: {
      body?: unknown;
      params?: Record<string, string | number | boolean | null | undefined>;
      teamId?: string;
    }
  ): Promise<T> {
    const token = await this.getToken();
    if (!token) {
      throw new Error('Not authenticated');
    }

    const url = new URL(`${this.baseUrl}${path}`);
    if (options?.params) {
      Object.entries(options.params).forEach(([key, value]) => {
        if (value !== undefined) {
          url.searchParams.set(key, String(value));
        }
      });
    }

    const headers: HeadersInit = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };

    if (options?.teamId) {
      headers['X-Team-Id'] = options.teamId;
    }

    const response = await fetch(url.toString(), {
      method,
      headers,
      body: options?.body ? JSON.stringify(options.body) : undefined,
    });

    if (!response.ok) {
      const error = (await response.json()) as AdminClientError;
      throw new AdminApiError(error, response.status);
    }

    // Handle empty responses (204 No Content)
    if (response.status === 204) {
      return undefined as T;
    }

    return response.json();
  }

  // ============================================================
  // Auth
  // ============================================================
  auth = {
    me: () => this.request<{ user: User }>('GET', '/auth/me'),
    logout: () => this.request<void>('POST', '/auth/logout'),
  };

  // ============================================================
  // Teams
  // ============================================================
  teams = {
    list: (params?: { page?: number; perPage?: number }) =>
      this.request<PaginatedResponse<Team>>('GET', '/teams', { params }),

    get: (teamId: string) => this.request<Team>('GET', `/teams/${teamId}`),

    create: (data: { name: string; slug?: string }) =>
      this.request<Team>('POST', '/teams', { body: data }),

    update: (teamId: string, data: { name?: string; settings?: TeamSettings }) =>
      this.request<Team>('PATCH', `/teams/${teamId}`, { body: data }),

    delete: (teamId: string) => this.request<void>('DELETE', `/teams/${teamId}`),

    // Members
    listMembers: (teamId: string, params?: { page?: number; perPage?: number }) =>
      this.request<PaginatedResponse<TeamMember & { user: User }>>('GET', `/teams/${teamId}/members`, { params }),

    inviteMember: (teamId: string, data: { email: string; role: TeamRole }) =>
      this.request<TeamInvite>('POST', `/teams/${teamId}/members`, { body: data }),

    updateMemberRole: (teamId: string, userId: string, role: TeamRole) =>
      this.request<TeamMember>('PATCH', `/teams/${teamId}/members/${userId}`, { body: { role } }),

    removeMember: (teamId: string, userId: string) =>
      this.request<void>('DELETE', `/teams/${teamId}/members/${userId}`),

    // Invites
    listInvites: (teamId: string) =>
      this.request<PaginatedResponse<TeamInvite>>('GET', `/teams/${teamId}/invites`),

    cancelInvite: (teamId: string, inviteId: string) =>
      this.request<void>('DELETE', `/teams/${teamId}/invites/${inviteId}`),
  };

  // ============================================================
  // Invites (public)
  // ============================================================
  invites = {
    accept: (inviteId: string) => this.request<{ team: Team }>('POST', `/invites/${inviteId}/accept`),
  };

  // ============================================================
  // Sources
  // ============================================================
  sources = {
    list: (teamId: string) => this.request<ProjectSource[]>('GET', `/teams/${teamId}/sources`),

    get: (sourceId: string) => this.request<ProjectSource>('GET', `/sources/${sourceId}`),

    validate: (sourceId: string) =>
      this.request<{ valid: boolean; error?: string }>('POST', `/sources/${sourceId}/validate`),
  };

  // ============================================================
  // Projects
  // ============================================================
  projects = {
    list: (teamId: string, params?: { page?: number; perPage?: number }) =>
      this.request<PaginatedResponse<Project>>('GET', `/teams/${teamId}/projects`, { params }),

    get: (projectId: string) => this.request<Project>('GET', `/projects/${projectId}`),

    create: (teamId: string, data: CreateProjectInput) =>
      this.request<Project>('POST', `/teams/${teamId}/projects`, { body: data }),

    update: (projectId: string, data: Partial<Project>) =>
      this.request<Project>('PATCH', `/projects/${projectId}`, { body: data }),

    delete: (projectId: string) => this.request<void>('DELETE', `/projects/${projectId}`),

    // Environment Variables
    getEnvVars: (projectId: string) =>
      this.request<EncryptedEnvVar[]>('GET', `/projects/${projectId}/env-vars`),

    setEnvVar: (projectId: string, data: { key: string; value: string; isSecret: boolean }) =>
      this.request<void>('POST', `/projects/${projectId}/env-vars`, { body: data }),

    deleteEnvVar: (projectId: string, key: string) =>
      this.request<void>('DELETE', `/projects/${projectId}/env-vars/${encodeURIComponent(key)}`),

    // API Tokens
    listApiTokens: (projectId: string) =>
      this.request<ProjectApiToken[]>('GET', `/projects/${projectId}/api-tokens`),

    createApiToken: (projectId: string, data: { name: string; scopes: string[]; expiresAt?: string }) =>
      this.request<{ token: string; tokenInfo: ProjectApiToken }>('POST', `/projects/${projectId}/api-tokens`, {
        body: data,
      }),

    revokeApiToken: (projectId: string, tokenId: string) =>
      this.request<void>('DELETE', `/projects/${projectId}/api-tokens/${tokenId}`),
  };

  // ============================================================
  // Deployments
  // ============================================================
  deployments = {
    list: (projectId: string, params?: { page?: number; perPage?: number }) =>
      this.request<PaginatedResponse<Deployment>>('GET', `/projects/${projectId}/deployments`, { params }),

    get: (deploymentId: string) => this.request<Deployment>('GET', `/deployments/${deploymentId}`),

    create: (projectId: string, data: CreateDeploymentInput) =>
      this.request<Deployment>('POST', `/projects/${projectId}/deployments`, { body: data }),

    update: (deploymentId: string, data: Partial<Deployment>) =>
      this.request<Deployment>('PATCH', `/deployments/${deploymentId}`, { body: data }),

    delete: (deploymentId: string) => this.request<void>('DELETE', `/deployments/${deploymentId}`),

    // Actions
    deploy: (deploymentId: string) => this.request<Build>('POST', `/deployments/${deploymentId}/deploy`),

    stop: (deploymentId: string) => this.request<void>('POST', `/deployments/${deploymentId}/stop`),

    restart: (deploymentId: string) => this.request<Build>('POST', `/deployments/${deploymentId}/restart`),

    rollback: (deploymentId: string, buildId?: string) =>
      this.request<Build>('POST', `/deployments/${deploymentId}/rollback`, { body: { buildId } }),
  };

  // ============================================================
  // Builds
  // ============================================================
  builds = {
    list: (deploymentId: string, params?: { page?: number; perPage?: number }) =>
      this.request<PaginatedResponse<Build>>('GET', `/deployments/${deploymentId}/builds`, { params }),

    get: (buildId: string) => this.request<Build>('GET', `/builds/${buildId}`),

    getLogs: (buildId: string) => this.request<{ logs: string }>('GET', `/builds/${buildId}/logs`),

    cancel: (buildId: string) => this.request<void>('POST', `/builds/${buildId}/cancel`),
  };

  // ============================================================
  // Servers
  // ============================================================
  servers = {
    get: (deploymentId: string) => this.request<RunningServer>('GET', `/deployments/${deploymentId}/server`),

    getHealth: (serverId: string) =>
      this.request<{ status: HealthStatus; details?: ServerHealthDetails }>('GET', `/servers/${serverId}/health`),

    getLogs: (serverId: string, params?: { limit?: number; since?: string }) =>
      this.request<{ logs: string[] }>('GET', `/servers/${serverId}/logs`, { params }),

    getMetrics: (serverId: string) => this.request<ServerMetrics>('GET', `/servers/${serverId}/metrics`),
  };

  // ============================================================
  // Observability
  // ============================================================
  observability = {
    traces: {
      list: (projectId: string, params?: TraceQueryParams) =>
        this.request<PaginatedResponse<Trace>>('GET', `/projects/${projectId}/traces`, {
          params: params as Record<string, string | number | boolean | null | undefined>,
        }),

      get: (traceId: string) => this.request<TraceWithSpans>('GET', `/traces/${traceId}`),
    },

    logs: {
      list: (projectId: string, params?: LogQueryParams) =>
        this.request<PaginatedResponse<Log>>('GET', `/projects/${projectId}/logs`, {
          params: params as Record<string, string | number | boolean | null | undefined>,
        }),
    },

    metrics: {
      get: (projectId: string, params?: MetricQueryParams) =>
        this.request<AggregatedMetrics>('GET', `/projects/${projectId}/metrics`, {
          params: params as Record<string, string | number | boolean | null | undefined>,
        }),
    },

    scores: {
      list: (projectId: string, params?: ScoreQueryParams) =>
        this.request<PaginatedResponse<Score>>('GET', `/projects/${projectId}/scores`, {
          params: params as Record<string, string | number | boolean | null | undefined>,
        }),
    },
  };
}

// Helper type for trace detail with spans
export interface TraceWithSpans extends Trace {
  spans: Span[];
}
