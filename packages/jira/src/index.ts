import { Integration, IntegrationCredentialType, IntegrationAuth } from '@mastra/core';

// @ts-ignore
import JiraLogo from './assets/jira.png';
import { comments } from './client/service-comments';
import * as integrationClient from './client/services.gen';
import * as zodSchema from './client/zodSchema';

type JiraConfig = {
  CLIENT_ID: string;
  CLIENT_SECRET: string;
  ATLASSIAN_SUBDOMAIN: string;
  [key: string]: any;
};

export class JiraIntegration extends Integration {
  categories = ['ticketing', 'support'];
  description =
    'Jira is a proprietary issue tracking product developed by Atlassian that allows bug tracking and agile project management.';
  availableScopes = [
    {
      key: `delete:async-task:jira`,
      description: `Delete asynchronous task.`,
    },
    {
      key: `delete:attachment:jira`,
      description: `Delete issue attachments.`,
    },
    {
      key: `delete:avatar:jira`,
      description: `Delete system and custom avatars.`,
    },
    {
      key: `delete:comment.property:jira`,
      description: `Delete issue comment properties.`,
    },
    {
      key: `delete:comment:jira`,
      description: `Delete issue comments.`,
    },
    {
      key: `delete:dashboard.property:jira`,
      description: `Delete dashboard properties.`,
    },
    {
      key: `delete:dashboard:jira`,
      description: `Delete dashboards.`,
    },
    {
      key: `delete:field-configuration-scheme:jira`,
      description: `Delete field configuration schemes.`,
    },
    {
      key: `delete:field-configuration:jira`,
      description: `Delete field configurations.`,
    },
    {
      key: `delete:field.option:jira`,
      description: `Delete field options.`,
    },
    {
      key: `delete:field:jira`,
      description: `Delete fields.`,
    },
    {
      key: `delete:filter.column:jira`,
      description: `Delete filter columns.`,
    },
    {
      key: `delete:filter:jira`,
      description: `Delete filters.`,
    },
    {
      key: `delete:group:jira`,
      description: `Delete user groups.`,
    },
    {
      key: `delete:issue-link-type:jira`,
      description: `Delete issue link types.`,
    },
    {
      key: `delete:issue-link:jira`,
      description: `Delete issue links.`,
    },
    {
      key: `delete:issue-type-scheme:jira`,
      description: `Delete issue type schemes.`,
    },
    {
      key: `delete:issue-type-screen-scheme:jira`,
      description: `Delete issue type screen schemes.`,
    },
    {
      key: `delete:issue-type.property:jira`,
      description: `Delete issue type properties.`,
    },
    {
      key: `delete:issue-type:jira`,
      description: `Delete issue types.`,
    },
    {
      key: `delete:issue-worklog.property:jira`,
      description: `Delete issue worklog properties.`,
    },
    {
      key: `delete:issue-worklog:jira`,
      description: `Delete issue worklogs.`,
    },
    {
      key: `delete:issue.property:jira`,
      description: `Delete issue properties.`,
    },
    {
      key: `delete:issue.remote-link:jira`,
      description: `Delete issue remote links.`,
    },
    {
      key: `delete:issue:jira`,
      description: `Delete issues.`,
    },
    {
      key: `delete:permission-scheme:jira`,
      description: `Delete permission schemes.`,
    },
    {
      key: `delete:permission:jira`,
      description: `Delete permissions.`,
    },
    {
      key: `delete:project-category:jira`,
      description: `Delete project categories.`,
    },
    {
      key: `delete:project-role:jira`,
      description: `Delete project roles.`,
    },
    {
      key: `delete:project-version:jira`,
      description: `Delete project versions.`,
    },
    {
      key: `delete:project.avatar:jira`,
      description: `Delete project avatars.`,
    },
    {
      key: `delete:project.component:jira`,
      description: `Delete project components.`,
    },
    {
      key: `delete:project.property:jira`,
      description: `Delete project properties.`,
    },
    {
      key: `delete:project:jira`,
      description: `Delete projects and their details, such as issue types, project lead, and avatars.`,
    },
    {
      key: `delete:screen-scheme:jira`,
      description: `Delete screen schemes.`,
    },
    {
      key: `delete:screen-tab:jira`,
      description: `Delete screen tabs.`,
    },
    {
      key: `delete:screen:jira`,
      description: `Delete screens.`,
    },
    {
      key: `delete:screenable-field:jira`,
      description: `Delete screenable fields.`,
    },
    {
      key: `delete:user-configuration:jira`,
      description: `Delete user configurations.`,
    },
    {
      key: `delete:user.property:jira`,
      description: `Delete user properties.`,
    },
    {
      key: `delete:webhook:jira`,
      description: `Delete webhooks.`,
    },
    {
      key: `delete:workflow-scheme:jira`,
      description: `Delete workflow schemes.`,
    },
    {
      key: `delete:workflow.property:jira`,
      description: `Delete workflow properties.`,
    },
    {
      key: `delete:workflow:jira`,
      description: `Delete workflows.`,
    },
    {
      key: `manage:jira-configuration`,
      description: `Configure Jira settings that require the Jira administrators permission, for example, create projects and custom fields, view workflows, manage issue link types.`,
    },
    {
      key: `manage:jira-project`,
      description: `Create and edit project settings and create new project-level objects, for example, versions, components.`,
    },
    {
      key: `manage:jira-webhook`,
      description: `Manage Jira webhooks. Enables an OAuth app to register and unregister dynamic webhooks in Jira. It also provides for fetching of registered webhooks.`,
    },
    {
      key: `read:app-data:jira`,
      description: `Read app data.`,
    },
    {
      key: `read:application-role:jira`,
      description: `View application roles.`,
    },
    {
      key: `read:attachment:jira`,
      description: `View issue attachments.`,
    },
    {
      key: `read:audit-log:jira`,
      description: `View audit logs.`,
    },
    {
      key: `read:avatar:jira`,
      description: `View system and custom avatars.`,
    },
    {
      key: `read:comment.property:jira`,
      description: `View issue comment properties.`,
    },
    {
      key: `read:comment:jira`,
      description: `View issue comments.`,
    },
    {
      key: `read:custom-field-contextual-configuration:jira`,
      description: `Read custom field contextual configurations.`,
    },
    {
      key: `read:dashboard.property:jira`,
      description: `View dashboard properties.`,
    },
    {
      key: `read:dashboard:jira`,
      description: `View dashboards.`,
    },
    {
      key: `read:email-address:jira`,
      description: `View email addresses of all users regardless of the user's profile visibility settings.`,
    },
    {
      key: `read:field-configuration-scheme:jira`,
      description: `View field configuration schemes.`,
    },
    {
      key: `read:field-configuration:jira`,
      description: `Read field configurations.`,
    },
    {
      key: `read:field.default-value:jira`,
      description: `View field default values.`,
    },
    {
      key: `read:field.option:jira`,
      description: `View field options.`,
    },
    {
      key: `read:field.options:jira`,
      description: `Read field options.`,
    },
    {
      key: `read:field:jira`,
      description: `View fields.`,
    },
    {
      key: `read:filter.column:jira`,
      description: `View filter columns.`,
    },
    {
      key: `read:filter.default-share-scope:jira`,
      description: `View filter default share scopes.`,
    },
    {
      key: `read:filter:jira`,
      description: `View filters.`,
    },
    {
      key: `read:group:jira`,
      description: `View user groups.`,
    },
    {
      key: `read:instance-configuration:jira`,
      description: `View instance configurations.`,
    },
    {
      key: `read:issue-details:jira`,
      description: `View issue details.`,
    },
    {
      key: `read:issue-event:jira`,
      description: `Read issue events.`,
    },
    {
      key: `read:issue-field-values:jira`,
      description: `View issue field valueses.`,
    },
    {
      key: `read:issue-link-type:jira`,
      description: `View issue link types.`,
    },
    {
      key: `read:issue-link:jira`,
      description: `View issue links.`,
    },
    {
      key: `read:issue-meta:jira`,
      description: `View issue meta.`,
    },
    {
      key: `read:issue-security-level:jira`,
      description: `View issue security levels.`,
    },
    {
      key: `read:issue-security-scheme:jira`,
      description: `View issue security schemes.`,
    },
    {
      key: `read:issue-status:jira`,
      description: `View issue statuses.`,
    },
    {
      key: `read:issue-type-hierarchy:jira`,
      description: `Read issue type hierarchies.`,
    },
    {
      key: `read:issue-type-scheme:jira`,
      description: `View issue type schemes.`,
    },
    {
      key: `read:issue-type-screen-scheme:jira`,
      description: `View issue type screen schemes.`,
    },
    {
      key: `read:issue-type.property:jira`,
      description: `View issue type properties.`,
    },
    {
      key: `read:issue-type:jira`,
      description: `View issue types.`,
    },
    {
      key: `read:issue-worklog.property:jira`,
      description: `View issue worklog properties.`,
    },
    {
      key: `read:issue-worklog:jira`,
      description: `View issue worklogs.`,
    },
    {
      key: `read:issue.changelog:jira`,
      description: `View issue changelogs.`,
    },
    {
      key: `read:issue.property:jira`,
      description: `View issue properties.`,
    },
    {
      key: `read:issue.remote-link:jira`,
      description: `View issue remote links.`,
    },
    {
      key: `read:issue.time-tracking:jira`,
      description: `View issue time trackings.`,
    },
    {
      key: `read:issue.transition:jira`,
      description: `View issue transitions.`,
    },
    {
      key: `read:issue.vote:jira`,
      description: `View issue votes.`,
    },
    {
      key: `read:issue.votes:jira`,
      description: `View issue voteses.`,
    },
    {
      key: `read:issue.watcher:jira`,
      description: `View issue watchers.`,
    },
    {
      key: `read:issue:jira`,
      description: `View issues.`,
    },
    {
      key: `read:jira-expressions:jira`,
      description: `View jira expressions.`,
    },
    {
      key: `read:jira-user`,
      description: `View user information in Jira that you have access to, including usernames, email addresses, and avatars.`,
    },
    {
      key: `read:jira-work`,
      description: `Read project and issue data. Search for issues and objects associated with issues (such as attachments and worklogs).`,
    },
    {
      key: `read:jql:jira`,
      description: `View JQL.`,
    },
    {
      key: `read:label:jira`,
      description: `View labels.`,
    },
    {
      key: `read:license:jira`,
      description: `View licenses.`,
    },
    {
      key: `read:notification-scheme:jira`,
      description: `View notification schemes.`,
    },
    {
      key: `read:permission-scheme:jira`,
      description: `View permission schemes.`,
    },
    {
      key: `read:permission:jira`,
      description: `View permissions.`,
    },
    {
      key: `read:priority:jira`,
      description: `View priorities.`,
    },
    {
      key: `read:project-category:jira`,
      description: `View project categories.`,
    },
    {
      key: `read:project-role:jira`,
      description: `View project roles.`,
    },
    {
      key: `read:project-type:jira`,
      description: `View project types.`,
    },
    {
      key: `read:project-version:jira`,
      description: `View project versions.`,
    },
    {
      key: `read:project.avatar:jira`,
      description: `Read project avatars.`,
    },
    {
      key: `read:project.component:jira`,
      description: `View project components.`,
    },
    {
      key: `read:project.email:jira`,
      description: `View project emails.`,
    },
    {
      key: `read:project.feature:jira`,
      description: `Read project features.`,
    },
    {
      key: `read:project.property:jira`,
      description: `View project properties.`,
    },
    {
      key: `read:project:jira`,
      description: `View projects.`,
    },
    {
      key: `read:resolution:jira`,
      description: `View resolutions.`,
    },
    {
      key: `read:role:jira`,
      description: `View roles.`,
    },
    {
      key: `read:screen-field:jira`,
      description: `View screen fields.`,
    },
    {
      key: `read:screen-scheme:jira`,
      description: `View screen schemes.`,
    },
    {
      key: `read:screen-tab:jira`,
      description: `View screen tabs.`,
    },
    {
      key: `read:screen:jira`,
      description: `View screens.`,
    },
    {
      key: `read:screenable-field:jira`,
      description: `View screenable fields.`,
    },
    {
      key: `read:status:jira`,
      description: `View statuses.`,
    },
    {
      key: `read:user-configuration:jira`,
      description: `View user configurations.`,
    },
    {
      key: `read:user.columns:jira`,
      description: `View user columnses.`,
    },
    {
      key: `read:user.property:jira`,
      description: `View user properties.`,
    },
    {
      key: `read:user:jira`,
      description: `View users.`,
    },
    {
      key: `read:webhook:jira`,
      description: `View webhooks.`,
    },
    {
      key: `read:workflow-scheme:jira`,
      description: `View workflow schemes.`,
    },
    {
      key: `read:workflow.property:jira`,
      description: `View workflow properties.`,
    },
    {
      key: `read:workflow:jira`,
      description: `View workflows.`,
    },
    {
      key: `send:notification:jira`,
      description: `Send notifications.`,
    },
    {
      key: `validate:jql:jira`,
      description: `Validate JQL.`,
    },
    {
      key: `write:app-data:jira`,
      description: `Write app data.`,
    },
    {
      key: `write:attachment:jira`,
      description: `Create and update issue attachments.`,
    },
    {
      key: `write:avatar:jira`,
      description: `Create and update system and custom avatars.`,
    },
    {
      key: `write:comment.property:jira`,
      description: `Create and update issue comment properties.`,
    },
    {
      key: `write:comment:jira`,
      description: `Create and update issue comments.`,
    },
    {
      key: `write:custom-field-contextual-configuration:jira`,
      description: `Save custom field contextual configurations.`,
    },
    {
      key: `write:dashboard.property:jira`,
      description: `Create and update dashboard properties.`,
    },
    {
      key: `write:dashboard:jira`,
      description: `Create and update dashboards.`,
    },
    {
      key: `write:field-configuration-scheme:jira`,
      description: `Create and update field configuration schemes.`,
    },
    {
      key: `write:field-configuration:jira`,
      description: `Save field configurations.`,
    },
    {
      key: `write:field.default-value:jira`,
      description: `Create and update field default values.`,
    },
    {
      key: `write:field.option:jira`,
      description: `Create and update field options.`,
    },
    {
      key: `write:field:jira`,
      description: `Create and update fields.`,
    },
    {
      key: `write:filter.column:jira`,
      description: `Create and update filter columns.`,
    },
    {
      key: `write:filter.default-share-scope:jira`,
      description: `Create and update filter default share scopes.`,
    },
    {
      key: `write:filter:jira`,
      description: `Create and update filters.`,
    },
    {
      key: `write:group:jira`,
      description: `Create and update user groups.`,
    },
    {
      key: `write:instance-configuration:jira`,
      description: `Create and update instance configurations.`,
    },
    {
      key: `write:issue-link-type:jira`,
      description: `Create and update issue link types.`,
    },
    {
      key: `write:issue-link:jira`,
      description: `Create and update issue links.`,
    },
    {
      key: `write:issue-type-scheme:jira`,
      description: `Create and update issue type schemes.`,
    },
    {
      key: `write:issue-type-screen-scheme:jira`,
      description: `Create and update issue type screen schemes.`,
    },
    {
      key: `write:issue-type.property:jira`,
      description: `Create and update issue type properties.`,
    },
    {
      key: `write:issue-type:jira`,
      description: `Create and update issue types.`,
    },
    {
      key: `write:issue-worklog.property:jira`,
      description: `Create and update issue worklog properties.`,
    },
    {
      key: `write:issue-worklog:jira`,
      description: `Create and update issue worklogs.`,
    },
    {
      key: `write:issue.property:jira`,
      description: `Create and update issue properties.`,
    },
    {
      key: `write:issue.remote-link:jira`,
      description: `Create and update issue remote links.`,
    },
    {
      key: `write:issue.time-tracking:jira`,
      description: `Create and update issue time trackings.`,
    },
    {
      key: `write:issue.vote:jira`,
      description: `Create and update issue votes.`,
    },
    {
      key: `write:issue.watcher:jira`,
      description: `Create and update issue watchers.`,
    },
    {
      key: `write:issue:jira`,
      description: `Create and update issues.`,
    },
    {
      key: `write:jira-work`,
      description: `Create and edit issues in Jira, post comments, create worklogs, and delete issues.`,
    },
    {
      key: `write:permission-scheme:jira`,
      description: `Create and update permission schemes.`,
    },
    {
      key: `write:permission:jira`,
      description: `Create and update permissions.`,
    },
    {
      key: `write:project-category:jira`,
      description: `Create and update project categories.`,
    },
    {
      key: `write:project-role:jira`,
      description: `Create and update project roles.`,
    },
    {
      key: `write:project-version:jira`,
      description: `Create and update project versions.`,
    },
    {
      key: `write:project.avatar:jira`,
      description: `Create and update project avatars.`,
    },
    {
      key: `write:project.component:jira`,
      description: `Create and update project components.`,
    },
    {
      key: `write:project.email:jira`,
      description: `Create and update project emails.`,
    },
    {
      key: `write:project.feature:jira`,
      description: `Save project features.`,
    },
    {
      key: `write:project.property:jira`,
      description: `Create and update project properties.`,
    },
    {
      key: `write:project:jira`,
      description: `Create and update projects.`,
    },
    {
      key: `write:screen-scheme:jira`,
      description: `Create and update screen schemes.`,
    },
    {
      key: `write:screen-tab:jira`,
      description: `Create and update screen tabs.`,
    },
    {
      key: `write:screen:jira`,
      description: `Create and update screens.`,
    },
    {
      key: `write:screenable-field:jira`,
      description: `Create and update screenable fields.`,
    },
    {
      key: `write:user-configuration:jira`,
      description: `Create and update user configurations.`,
    },
    {
      key: `write:user.property:jira`,
      description: `Create and update user properties.`,
    },
    {
      key: `write:webhook:jira`,
      description: `Create and update webhooks.`,
    },
    {
      key: `write:workflow-scheme:jira`,
      description: `Create and update workflow schemes.`,
    },
    {
      key: `write:workflow.property:jira`,
      description: `Create and update workflow properties.`,
    },
    {
      key: `write:workflow:jira`,
      description: `Create and update workflows.`,
    },
  ];

  constructor({ config }: { config: JiraConfig }) {
    super({
      ...config,
      authType: IntegrationCredentialType.OAUTH,
      name: 'JIRA',
      logoUrl: JiraLogo,
    });
  }

  getClientZodSchema() {
    return zodSchema;
  }

  getCommentsForClientApis() {
    return comments;
  }

  getBaseClient() {
    integrationClient.client.setConfig({
      baseUrl: 'https:/${this.config.ATLASSIAN_SUBDOMAIN}.atlassian.net',
    });
    return integrationClient;
  }

  getApiClient = async ({ connectionId }: { connectionId: string }) => {
    const connection = await this.dataLayer?.getConnection({ name: this.name, connectionId });

    if (!connection) {
      throw new Error(`Connection not found for connectionId: ${connectionId}`);
    }

    const authenticator = this.getAuthenticator();
    const { accessToken } = await authenticator.getAuthToken({ k_id: connection.id });

    const baseClient = this.getBaseClient();

    baseClient.client.interceptors.request.use((request, options) => {
      request.headers.set('Authorization', `Bearer ${accessToken}`);
      return request;
    });

    return integrationClient;
  };

  registerEvents() {
    this.events = {};
    return this.events;
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
        SERVER: `https:/${this.config.ATLASSIAN_SUBDOMAIN}.atlassian.net`,
        AUTHORIZATION_ENDPOINT: `https://auth.atlassian.com/authorize`,
        TOKEN_ENDPOINT: `https://auth.atlassian.com/oauth/token`,
        SCOPES: this.config.SCOPES || [],
      },
    });
  }
}
