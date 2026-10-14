import type { PlatformApiClient } from '../api-client.js';
import { PlatformApiError } from '../api-client.js';

export type PageInfo = { hasNextPage: boolean; endCursor: string | null };
export type LinearUser = {
  id: string;
  name: string;
  displayName: string;
  email: string | null;
  avatarUrl: string | null;
};
export type LinearIssue = {
  id: string;
  identifier: string;
  number: number;
  title: string;
  description: string | null;
  url: string;
  priority: number;
  priorityLabel: string;
  labels: Array<{ id: string; name: string }>;
  state: { id: string; name: string; type: string };
  team: { id: string; key: string; name: string };
  project: { id: string } | null;
  assignee: LinearUser | null;
  creator: LinearUser | null;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
};
export type LinearComment = {
  id: string;
  body: string;
  url: string;
  issue: { id: string; identifier: string };
  user: LinearUser | null;
  parent: { id: string } | null;
  createdAt: string;
  updatedAt: string;
};
export type LinearProject = {
  id: string;
  name: string;
  state: string;
  teams: Array<{ id: string; key: string; name: string }>;
};
export type LinearTeam = { id: string; key: string; name: string };
export type LinearWorkflowState = { id: string; name: string; type: string; position: number; teamId: string };
export type LinearOrganization = { id: string; name: string; urlKey: string | null };
export type IssueWithComments = LinearIssue & { comments?: { nodes: LinearComment[]; pageInfo: PageInfo } };
export type LinearCreatedIssue = { id: string; identifier: string; title: string; url: string };

const USER_FIELDS = 'id name displayName email avatarUrl';
const ISSUE_FIELDS = `
  id identifier number title description url priority priorityLabel createdAt updatedAt archivedAt
  labels(first: 50) { nodes { id name } }
  state { id name type }
  team { id key name }
  project { id }
  assignee { ${USER_FIELDS} }
  creator { ${USER_FIELDS} }
`;
const COMMENT_FIELDS = `
  id body url createdAt updatedAt
  issue { id identifier }
  user { ${USER_FIELDS} }
  parent { id }
`;

type RawIssue = Omit<LinearIssue, 'labels'> & {
  labels: { nodes: Array<{ id: string; name: string }> };
  comments?: { nodes: LinearComment[]; pageInfo: PageInfo };
};

function toIssue(raw: RawIssue): IssueWithComments {
  const { labels, ...rest } = raw;
  return { ...rest, labels: labels.nodes };
}

/**
 * Linear's GraphQL API reached through a Platform Connect connection
 * (`/v2/connections/:id/proxy/graphql`). Platform injects the connection's
 * OAuth credential; Factory only authenticates with its Platform API key.
 */
export class LinearProxyApi {
  readonly #client: PlatformApiClient;
  readonly #path: string;

  constructor(client: PlatformApiClient, connectionId: string) {
    this.#client = client;
    this.#path = `/v2/connections/${encodeURIComponent(connectionId)}/proxy/graphql`;
  }

  async graphql<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
    const result = await this.#client.request<{ data?: T | null; errors?: Array<{ message?: string; extensions?: { code?: string } }> }>(
      'POST',
      this.#path,
      { query, variables },
    );
    if (result.errors?.length) {
      const message = result.errors.map(error => error.message ?? 'Unknown error').join('; ');
      const notFound = result.errors.some(
        error => error.extensions?.code === 'NOT_FOUND' || /entity not found|could not find/i.test(error.message ?? ''),
      );
      const unauthorized = result.errors.some(error => error.extensions?.code === 'AUTHENTICATION_ERROR');
      throw new PlatformApiError(`Linear GraphQL error: ${message}`, notFound ? 404 : unauthorized ? 401 : 502);
    }
    if (!result.data) throw new PlatformApiError('Linear GraphQL response had no data.', 502);
    return result.data;
  }

  async organization(): Promise<LinearOrganization> {
    const data = await this.graphql<{ organization: LinearOrganization }>('query { organization { id name urlKey } }');
    return data.organization;
  }

  async listProjects(after?: string): Promise<{ projects: LinearProject[]; pageInfo: PageInfo }> {
    const data = await this.graphql<{
      projects: {
        nodes: Array<Omit<LinearProject, 'teams'> & { teams: { nodes: LinearTeam[] } }>;
        pageInfo: PageInfo;
      };
    }>(
      `query($after: String) { projects(first: 100, after: $after) {
        nodes { id name state teams(first: 10) { nodes { id key name } } }
        pageInfo { hasNextPage endCursor }
      } }`,
      { after: after ?? null },
    );
    return {
      projects: data.projects.nodes.map(project => ({ ...project, teams: project.teams.nodes })),
      pageInfo: data.projects.pageInfo,
    };
  }

  async listTeams(after?: string): Promise<{ teams: LinearTeam[]; pageInfo: PageInfo }> {
    const data = await this.graphql<{ teams: { nodes: LinearTeam[]; pageInfo: PageInfo } }>(
      `query($after: String) { teams(first: 200, after: $after) {
        nodes { id key name } pageInfo { hasNextPage endCursor }
      } }`,
      { after: after ?? null },
    );
    return { teams: data.teams.nodes, pageInfo: data.teams.pageInfo };
  }

  async listIssues(input: {
    first: number;
    after?: string;
    projectId?: string;
    teamId?: string;
  }): Promise<{ issues: LinearIssue[]; pageInfo: PageInfo }> {
    const filter: Record<string, unknown> = {
      state: { type: { in: ['triage', 'backlog', 'unstarted', 'started'] } },
    };
    if (input.projectId) filter.project = { id: { eq: input.projectId } };
    if (input.teamId) filter.team = { id: { eq: input.teamId } };
    const data = await this.graphql<{ issues: { nodes: RawIssue[]; pageInfo: PageInfo } }>(
      `query($first: Int!, $after: String, $filter: IssueFilter) {
        issues(first: $first, after: $after, filter: $filter, orderBy: updatedAt) {
          nodes { ${ISSUE_FIELDS} } pageInfo { hasNextPage endCursor }
        }
      }`,
      { first: input.first, after: input.after ?? null, filter },
    );
    return { issues: data.issues.nodes.map(toIssue), pageInfo: data.issues.pageInfo };
  }

  async getIssue(idOrIdentifier: string, options: { comments?: boolean } = {}): Promise<IssueWithComments> {
    const comments = options.comments
      ? `comments(first: 200) { nodes { ${COMMENT_FIELDS} } pageInfo { hasNextPage endCursor } }`
      : '';
    const data = await this.graphql<{ issue: RawIssue | null }>(
      `query($id: String!) { issue(id: $id) { ${ISSUE_FIELDS} ${comments} } }`,
      { id: idOrIdentifier },
    );
    if (!data.issue) throw new PlatformApiError('Linear issue not found.', 404);
    return toIssue(data.issue);
  }

  async listComments(issueId: string, after: string): Promise<{ comments: LinearComment[]; pageInfo: PageInfo }> {
    const data = await this.graphql<{
      issue: { comments: { nodes: LinearComment[]; pageInfo: PageInfo } } | null;
    }>(
      `query($id: String!, $after: String) { issue(id: $id) {
        comments(first: 200, after: $after) { nodes { ${COMMENT_FIELDS} } pageInfo { hasNextPage endCursor } }
      } }`,
      { id: issueId, after },
    );
    if (!data.issue) throw new PlatformApiError('Linear issue not found.', 404);
    return { comments: data.issue.comments.nodes, pageInfo: data.issue.comments.pageInfo };
  }

  async listWorkflowStates(teamId: string): Promise<LinearWorkflowState[]> {
    const data = await this.graphql<{
      workflowStates: { nodes: Array<Omit<LinearWorkflowState, 'teamId'> & { team: { id: string } }> };
    }>(
      `query($teamId: ID!) { workflowStates(first: 100, filter: { team: { id: { eq: $teamId } } }) {
        nodes { id name type position team { id } }
      } }`,
      { teamId },
    );
    return data.workflowStates.nodes.map(({ team, ...state }) => ({ ...state, teamId: team.id }));
  }

  async updateIssueState(issueId: string, stateId: string): Promise<void> {
    const data = await this.graphql<{ issueUpdate: { success: boolean } }>(
      `mutation($id: String!, $input: IssueUpdateInput!) { issueUpdate(id: $id, input: $input) { success } }`,
      { id: issueId, input: { stateId } },
    );
    if (!data.issueUpdate.success) throw new PlatformApiError('Linear rejected the issue update.', 502);
  }

  async createComment(issueId: string, body: string): Promise<{ id: string; url: string }> {
    const data = await this.graphql<{ commentCreate: { success: boolean; comment: { id: string; url: string } | null } }>(
      `mutation($input: CommentCreateInput!) { commentCreate(input: $input) { success comment { id url } } }`,
      { input: { issueId, body } },
    );
    if (!data.commentCreate.success || !data.commentCreate.comment) {
      throw new PlatformApiError('Linear rejected the comment.', 502);
    }
    return data.commentCreate.comment;
  }

  async createIssue(input: {
    teamId: string;
    title: string;
    description?: string;
    priority?: number;
  }): Promise<LinearCreatedIssue> {
    const data = await this.graphql<{ issueCreate: { success: boolean; issue: LinearCreatedIssue | null } }>(
      `mutation($input: IssueCreateInput!) { issueCreate(input: $input) { success issue { id identifier title url } } }`,
      { input },
    );
    if (!data.issueCreate.success || !data.issueCreate.issue) {
      throw new PlatformApiError('Linear rejected the issue.', 502);
    }
    return data.issueCreate.issue;
  }
}
