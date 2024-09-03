import { Integration, IntegrationAuth, OpenAPI } from '@arkw/core';
import { createClient, type OASClient, type NormalizeOAS } from 'fets';
import { z } from 'zod';

// @ts-ignore
import asanaIcon from './assets/asana.svg';
import { AttachmentsForObject } from './events/AttachmentsForObject';
import { AuditLogEvents } from './events/AuditLogEvents';
import { CustomFieldSettingsForPortfolio } from './events/CustomFieldSettingsForPortfolio';
import { CustomFieldSettingsForProject } from './events/CustomFieldSettingsForProject';
import { CustomFieldsForWorkspace } from './events/CustomFieldsForWorkspace';
import { DependenciesForTask } from './events/DependenciesForTask';
import { DependentsForTask } from './events/DependentsForTask';
import { Events } from './events/Events';
import { FavoritesForUser } from './events/FavoritesForUser';
import { GoalRelationships } from './events/GoalRelationships';
import { Goals } from './events/Goals';
import { ItemsForPortfolio } from './events/ItemsForPortfolio';
import { ParentGoalsForGoal } from './events/ParentGoalsForGoal';
import { PortfolioMemberships } from './events/PortfolioMemberships';
import { PortfolioMembershipsForPortfolio } from './events/PortfolioMembershipsForPortfolio';
import { Portfolios } from './events/Portfolios';
import { ProjectMembershipsForProject } from './events/ProjectMembershipsForProject';
import { ProjectStatusesForProject } from './events/ProjectStatusesForProject';
import { ProjectTemplates } from './events/ProjectTemplates';
import { ProjectTemplatesForTeam } from './events/ProjectTemplatesForTeam';
import { Projects } from './events/Projects';
import { ProjectsForTask } from './events/ProjectsForTask';
import { ProjectsForTeam } from './events/ProjectsForTeam';
import { ProjectsForWorkspace } from './events/ProjectsForWorkspace';
import { SectionsForProject } from './events/SectionsForProject';
import { StatusesForObject } from './events/StatusesForObject';
import { SubtasksForTask } from './events/SubtasksForTask';
import { Tags } from './events/Tags';
import { TagsForTask } from './events/TagsForTask';
import { TagsForWorkspace } from './events/TagsForWorkspace';
import { Tasks } from './events/Tasks';
import { TasksForProject } from './events/TasksForProject';
import { TasksForSection } from './events/TasksForSection';
import { TasksForTag } from './events/TasksForTag';
import { TasksForUserTaskList } from './events/TasksForUserTaskList';
import { TeamMemberships } from './events/TeamMemberships';
import { TeamMembershipsForTeam } from './events/TeamMembershipsForTeam';
import { TeamMembershipsForUser } from './events/TeamMembershipsForUser';
import { TeamsForUser } from './events/TeamsForUser';
import { TeamsForWorkspace } from './events/TeamsForWorkspace';
import { TimePeriods } from './events/TimePeriods';
import { Users } from './events/Users';
import { UsersForTeam } from './events/UsersForTeam';
import { UsersForWorkspace } from './events/UsersForWorkspace';
import { Webhooks } from './events/Webhooks';
import { WorkspaceMembershipsForUser } from './events/WorkspaceMembershipsForUser';
import { WorkspaceMembershipsForWorkspace } from './events/WorkspaceMembershipsForWorkspace';
import { Workspaces } from './events/Workspaces';
import { searchTasksForWorkspace } from './events/searchTasksForWorkspace';
import { typeaheadForWorkspace } from './events/typeaheadForWorkspace';
import openapi from './openapi';

type AsanaConfig = {
  CLIENT_ID: string;
  CLIENT_SECRET: string;
  [key: string]: any;
};

export class AsanaIntegration extends Integration {
  config: AsanaConfig;

  constructor({ config }: { config: AsanaConfig }) {
    config.authType = `OAUTH`;

    super({
      ...config,
      name: 'ASANA',
      logoUrl: asanaIcon,
    });

    this.config = config;
  }

  registerEvents() {
    this.events = {
      'asana.AttachmentsForObject/sync': {
        schema: z.object({
          limit: z.string(),
          offset: z.string(),
          parent: z.string(),
        }),
        handler: AttachmentsForObject,
      },

      'asana.Events/sync': {
        schema: z.object({}),
        handler: Events,
      },

      'asana.GoalRelationships/sync': {
        schema: z.object({
          pretty: z.string(),
          fields: z.string(),
          supported_goal: z.string(),
          resource_subtype: z.string(),
        }),
        handler: GoalRelationships,
      },

      'asana.Goals/sync': {
        schema: z.object({
          portfolio: z.string(),
          project: z.string(),
          is_workspace_level: z.boolean(),
          team: z.string(),
          workspace: z.string(),
          time_periods: z.string(),
        }),
        handler: Goals,
      },

      'asana.ParentGoalsForGoal/sync': {
        schema: z.object({
          goal_gid: z.string(),
        }),
        handler: ParentGoalsForGoal,
      },

      'asana.PortfolioMemberships/sync': {
        schema: z.object({}),
        handler: PortfolioMemberships,
      },

      'asana.Portfolios/sync': {
        schema: z.object({
          limit: z.string(),
          offset: z.string(),
          workspace: z.string(),
          owner: z.string(),
        }),
        handler: Portfolios,
      },

      'asana.CustomFieldSettingsForPortfolio/sync': {
        schema: z.object({
          portfolio_gid: z.string(),
        }),
        handler: CustomFieldSettingsForPortfolio,
      },

      'asana.ItemsForPortfolio/sync': {
        schema: z.object({
          portfolio_gid: z.string(),
        }),
        handler: ItemsForPortfolio,
      },

      'asana.PortfolioMembershipsForPortfolio/sync': {
        schema: z.object({
          portfolio_gid: z.string(),
        }),
        handler: PortfolioMembershipsForPortfolio,
      },

      'asana.ProjectTemplates/sync': {
        schema: z.object({
          workspace_query_param: z.string(),
          team_query_param: z.string(),
          limit: z.string(),
          offset: z.string(),
        }),
        handler: ProjectTemplates,
      },

      'asana.Projects/sync': {
        schema: z.object({
          limit: z.string(),
          offset: z.string(),
          workspace: z.string(),
          team: z.string(),
          archived_query_param: z.string(),
        }),
        handler: Projects,
      },

      'asana.CustomFieldSettingsForProject/sync': {
        schema: z.object({
          project_gid: z.string(),
        }),
        handler: CustomFieldSettingsForProject,
      },

      'asana.ProjectMembershipsForProject/sync': {
        schema: z.object({
          project_gid: z.string(),
        }),
        handler: ProjectMembershipsForProject,
      },

      'asana.ProjectStatusesForProject/sync': {
        schema: z.object({
          project_path_gid: z.string(),
          pretty: z.string(),
          fields: z.string(),
          limit: z.string(),
          offset: z.string(),
          project_gid: z.string(),
        }),
        handler: ProjectStatusesForProject,
      },

      'asana.SectionsForProject/sync': {
        schema: z.object({
          limit: z.string(),
          offset: z.string(),
          project_gid: z.string(),
        }),
        handler: SectionsForProject,
      },

      'asana.TasksForProject/sync': {
        schema: z.object({
          project_gid: z.string(),
        }),
        handler: TasksForProject,
      },

      'asana.TasksForSection/sync': {
        schema: z.object({
          section_gid: z.string(),
        }),
        handler: TasksForSection,
      },

      'asana.StatusesForObject/sync': {
        schema: z.object({
          parent: z.string(),
          created_since: z.string(),
        }),
        handler: StatusesForObject,
      },

      'asana.Tags/sync': {
        schema: z.object({
          limit: z.string(),
          offset: z.string(),
          workspace: z.string(),
        }),
        handler: Tags,
      },

      'asana.TasksForTag/sync': {
        schema: z.object({
          tag_gid: z.string(),
        }),
        handler: TasksForTag,
      },

      'asana.Tasks/sync': {
        schema: z.object({
          limit: z.string(),
          offset: z.string(),
          assignee: z.string(),
          project: z.string(),
          section: z.string(),
          workspace: z.string(),
          completed_since: z.string(),
          modified_since: z.string(),
        }),
        handler: Tasks,
      },

      'asana.DependenciesForTask/sync': {
        schema: z.object({
          task_gid: z.string(),
        }),
        handler: DependenciesForTask,
      },

      'asana.DependentsForTask/sync': {
        schema: z.object({
          task_gid: z.string(),
        }),
        handler: DependentsForTask,
      },

      'asana.ProjectsForTask/sync': {
        schema: z.object({
          task_gid: z.string(),
        }),
        handler: ProjectsForTask,
      },

      'asana.SubtasksForTask/sync': {
        schema: z.object({
          limit: z.string(),
          offset: z.string(),
          task_gid: z.string(),
        }),
        handler: SubtasksForTask,
      },

      'asana.TagsForTask/sync': {
        schema: z.object({
          task_gid: z.string(),
        }),
        handler: TagsForTask,
      },

      'asana.TeamMemberships/sync': {
        schema: z.object({
          team: z.string(),
          user: z.string(),
          workspace: z.string(),
        }),
        handler: TeamMemberships,
      },

      'asana.ProjectTemplatesForTeam/sync': {
        schema: z.object({
          limit: z.string(),
          offset: z.string(),
          team_gid: z.string(),
        }),
        handler: ProjectTemplatesForTeam,
      },

      'asana.ProjectsForTeam/sync': {
        schema: z.object({
          limit: z.string(),
          offset: z.string(),
          archived_query_param: z.string(),
          team_gid: z.string(),
        }),
        handler: ProjectsForTeam,
      },

      'asana.TeamMembershipsForTeam/sync': {
        schema: z.object({
          team_gid: z.string(),
        }),
        handler: TeamMembershipsForTeam,
      },

      'asana.UsersForTeam/sync': {
        schema: z.object({
          team_gid: z.string(),
        }),
        handler: UsersForTeam,
      },

      'asana.TimePeriods/sync': {
        schema: z.object({
          start_on: z.string(),
          end_on: z.string(),
          workspace: z.string(),
        }),
        handler: TimePeriods,
      },

      'asana.TasksForUserTaskList/sync': {
        schema: z.object({
          user_task_list_gid: z.string(),
        }),
        handler: TasksForUserTaskList,
      },

      'asana.Users/sync': {
        schema: z.object({}),
        handler: Users,
      },

      'asana.FavoritesForUser/sync': {
        schema: z.object({
          user_gid: z.string(),
        }),
        handler: FavoritesForUser,
      },

      'asana.TeamMembershipsForUser/sync': {
        schema: z.object({
          workspace: z.string(),
          user_gid: z.string(),
        }),
        handler: TeamMembershipsForUser,
      },

      'asana.TeamsForUser/sync': {
        schema: z.object({
          user_gid: z.string(),
        }),
        handler: TeamsForUser,
      },

      'asana.WorkspaceMembershipsForUser/sync': {
        schema: z.object({
          user_gid: z.string(),
        }),
        handler: WorkspaceMembershipsForUser,
      },

      'asana.Webhooks/sync': {
        schema: z.object({
          limit: z.string(),
          offset: z.string(),
          workspace: z.string(),
          resource: z.string(),
        }),
        handler: Webhooks,
      },

      'asana.Workspaces/sync': {
        schema: z.object({}),
        handler: Workspaces,
      },

      'asana.AuditLogEvents/sync': {
        schema: z.object({
          workspace_gid: z.string(),
        }),
        handler: AuditLogEvents,
      },

      'asana.CustomFieldsForWorkspace/sync': {
        schema: z.object({
          workspace_gid: z.string(),
        }),
        handler: CustomFieldsForWorkspace,
      },

      'asana.ProjectsForWorkspace/sync': {
        schema: z.object({
          limit: z.string(),
          offset: z.string(),
          archived_query_param: z.string(),
          workspace_gid: z.string(),
        }),
        handler: ProjectsForWorkspace,
      },

      'asana.TagsForWorkspace/sync': {
        schema: z.object({
          limit: z.string(),
          offset: z.string(),
          workspace_gid: z.string(),
        }),
        handler: TagsForWorkspace,
      },

      'asana.searchTasksForWorkspace/sync': {
        schema: z.object({
          workspace_gid: z.string(),
        }),
        handler: searchTasksForWorkspace,
      },

      'asana.TeamsForWorkspace/sync': {
        schema: z.object({
          workspace_gid: z.string(),
        }),
        handler: TeamsForWorkspace,
      },

      'asana.typeaheadForWorkspace/sync': {
        schema: z.object({
          workspace_gid: z.string(),
        }),
        handler: typeaheadForWorkspace,
      },

      'asana.UsersForWorkspace/sync': {
        schema: z.object({
          workspace_gid: z.string(),
        }),
        handler: UsersForWorkspace,
      },

      'asana.WorkspaceMembershipsForWorkspace/sync': {
        schema: z.object({
          workspace_gid: z.string(),
        }),
        handler: WorkspaceMembershipsForWorkspace,
      },
    };
    return this.events;
  }

  getOpenApiSpec() {
    return openapi as unknown as OpenAPI;
  }

  async getApiClient({ referenceId }: { referenceId: string }): Promise<OASClient<NormalizeOAS<typeof openapi>>> {
    const connection = await this.dataLayer?.getConnectionByReferenceId({ name: this.name, referenceId });

    if (!connection) {
      throw new Error(`Connection not found for referenceId: ${referenceId}`);
    }

    // TODO: HANDLE REFRESH TOKEN IF EXPIRED
    const credential = await this.dataLayer?.getCredentialsByConnectionId(connection.id);

    const client = createClient<NormalizeOAS<typeof openapi>>({
      endpoint: 'https://app.asana.com/api/1.0',
      globalParams: {
        headers: {
          Authorization: `Bearer ${credential?.value}`,
        },
      },
    });

    return client;
  }

  getAuthenticator() {
    return new IntegrationAuth({
      dataAccess: this.dataLayer!,
      // @ts-ignore
      onConnectionCreated: () => {
        // TODO
      },
      config: {
        INTEGRATION_NAME: this.name,
        AUTH_TYPE: this.config.authType,
        CLIENT_ID: this.config.CLIENT_ID,
        CLIENT_SECRET: this.config.CLIENT_SECRET,
        REDIRECT_URI: this.config.REDIRECT_URI || this.corePresets.redirectURI,
        SERVER: `https://app.asana.com`,
        AUTHORIZATION_ENDPOINT: '/-/oauth_authorize',
        TOKEN_ENDPOINT: '/-/oauth_token',
        SCOPES: [],
      },
    });
  }
}
