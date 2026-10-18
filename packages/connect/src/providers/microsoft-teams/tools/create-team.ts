// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

const TeamMemberSchema = z.object({
  user_id: z.string().describe('User ID to add as a member. Example: "0040b377-61d8-43db-94f5-81374122dc7e"'),
  roles: z
    .array(z.enum(['owner', 'member']))
    .optional()
    .describe('Member roles. Defaults to ["member"].'),
});

const ChannelTabConfigurationSchema = z.object({
  content_url: z.string().describe('Tab content URL.'),
  website_url: z.string().optional().describe('Tab website URL.'),
});

const ChannelTabSchema = z.object({
  teams_app_id: z.string().describe('Teams app ID. Example: "com.microsoft.teamspace.tab.web"'),
  display_name: z.string().describe('Tab display name.'),
  configuration: ChannelTabConfigurationSchema,
});

const ChannelSchema = z.object({
  display_name: z.string().describe('Channel display name.'),
  description: z.string().optional().describe('Channel description.'),
  is_favorite_by_default: z.boolean().optional().describe('Whether the channel is favorited by default.'),
  tabs: z.array(ChannelTabSchema).optional().describe('Tabs to install in the channel.'),
});

const InstalledAppSchema = z.object({
  teams_app_id: z.string().describe('Teams app ID to install. Example: "com.microsoft.teamspace.tab.vsts"'),
});

const MemberSettingsSchema = z.object({
  allow_create_update_channels: z.boolean().optional(),
  allow_delete_channels: z.boolean().optional(),
  allow_add_remove_apps: z.boolean().optional(),
  allow_create_update_remove_tabs: z.boolean().optional(),
  allow_create_update_remove_connectors: z.boolean().optional(),
});

const GuestSettingsSchema = z.object({
  allow_create_update_channels: z.boolean().optional(),
  allow_delete_channels: z.boolean().optional(),
});

const FunSettingsSchema = z.object({
  allow_giphy: z.boolean().optional(),
  giphy_content_rating: z.enum(['strict', 'moderate']).optional(),
  allow_stickers_and_memes: z.boolean().optional(),
  allow_custom_memes: z.boolean().optional(),
});

const MessagingSettingsSchema = z.object({
  allow_user_edit_messages: z.boolean().optional(),
  allow_user_delete_messages: z.boolean().optional(),
  allow_owner_delete_messages: z.boolean().optional(),
  allow_team_mentions: z.boolean().optional(),
  allow_channel_mentions: z.boolean().optional(),
});

const DiscoverySettingsSchema = z.object({
  show_in_teams_search_and_suggestions: z.boolean().optional(),
});

export const createTeamInputSchema = z.object({
  display_name: z.string().describe('Display name of the team. Example: "My Sample Team"'),
  description: z.string().optional().describe('Description of the team.'),
  template: z
    .string()
    .optional()
    .describe('Template ID or name. Example: "standard" or "educationClass". Defaults to "standard".'),
  first_channel_name: z.string().optional().describe('Name of the first (General) channel. Defaults to "General".'),
  visibility: z.enum(['public', 'private', 'hiddenMembership']).optional().describe('Team visibility.'),
  group_id: z
    .string()
    .optional()
    .describe('Existing group ID to create the team from. If provided, team is created from this group.'),
  members: z
    .array(TeamMemberSchema)
    .optional()
    .describe('Members to add to the team. Required for application permissions.'),
  channels: z.array(ChannelSchema).optional().describe('Channels to create with the team.'),
  member_settings: MemberSettingsSchema.optional().describe('Member settings for the team.'),
  guest_settings: GuestSettingsSchema.optional().describe('Guest settings for the team.'),
  fun_settings: FunSettingsSchema.optional().describe('Fun settings for the team.'),
  messaging_settings: MessagingSettingsSchema.optional().describe('Messaging settings for the team.'),
  discovery_settings: DiscoverySettingsSchema.optional().describe('Discovery settings for the team.'),
  installed_apps: z.array(InstalledAppSchema).optional().describe('Apps to install in the team.'),
});

const ProviderAsyncOperationSchema = z.object({
  id: z.string(),
  operation_type: z.string().optional(),
  status: z.enum(['notStarted', 'inProgress', 'succeeded', 'failed']).or(z.string()),
  created_date_time: z.string().optional(),
  last_action_date_time: z.string().optional(),
  error: z
    .object({
      code: z.string(),
      message: z.string(),
    })
    .optional(),
});

export const createTeamOutputSchema = z.object({
  team_id: z.string().optional().describe('ID of the created team (available after operation succeeds).'),
  operation_id: z.string().describe('ID of the async operation.'),
  operation_url: z.string().describe('URL to poll for operation status.'),
  status: z
    .enum(['notStarted', 'inProgress', 'succeeded', 'failed'])
    .or(z.string())
    .describe('Current operation status.'),
  error: z
    .object({
      code: z.string(),
      message: z.string(),
    })
    .optional()
    .describe('Error details if the operation failed.'),
});

interface TeamRequestBody {
  'template@odata.bind': string;
  displayName: string;
  description?: string;
  firstChannelName?: string;
  visibility?: string;
  'group@odata.bind'?: string;
  members?: Array<{
    '@odata.type': string;
    roles: string[];
    'user@odata.bind': string;
  }>;
  channels?: Array<{
    displayName: string;
    description?: string;
    isFavoriteByDefault?: boolean;
    tabs?: Array<{
      'teamsApp@odata.bind': string;
      displayName: string;
      configuration: {
        contentUrl: string;
        websiteUrl?: string;
      };
    }>;
  }>;
  memberSettings?: {
    allowCreateUpdateChannels?: boolean;
    allowDeleteChannels?: boolean;
    allowAddRemoveApps?: boolean;
    allowCreateUpdateRemoveTabs?: boolean;
    allowCreateUpdateRemoveConnectors?: boolean;
  };
  guestSettings?: {
    allowCreateUpdateChannels?: boolean;
    allowDeleteChannels?: boolean;
  };
  funSettings?: {
    allowGiphy?: boolean;
    giphyContentRating?: string;
    allowStickersAndMemes?: boolean;
    allowCustomMemes?: boolean;
  };
  messagingSettings?: {
    allowUserEditMessages?: boolean;
    allowUserDeleteMessages?: boolean;
    allowOwnerDeleteMessages?: boolean;
    allowTeamMentions?: boolean;
    allowChannelMentions?: boolean;
  };
  discoverySettings?: {
    showInTeamsSearchAndSuggestions?: boolean;
  };
  installedApps?: Array<{
    'teamsApp@odata.bind': string;
  }>;
}

export function createTeamTool(proxy: PlatformProxy) {
  return createTool({
    id: 'microsoft_teams_create_team',
    description: 'Create a team from a template or existing group.',
    inputSchema: createTeamInputSchema,
    outputSchema: createTeamOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createTeamOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const template = input.template || 'standard';
      const templateBind = `https://graph.microsoft.com/v1.0/teamsTemplates('${template}')`;

      const requestBody: TeamRequestBody = {
        'template@odata.bind': templateBind,
        displayName: input.display_name,
        ...(input.description !== undefined && { description: input.description }),
        ...(input.first_channel_name !== undefined && { firstChannelName: input.first_channel_name }),
        ...(input.visibility !== undefined && { visibility: input.visibility }),
        ...(input.group_id !== undefined && {
          'group@odata.bind': `https://graph.microsoft.com/v1.0/groups('${input.group_id}')`,
        }),
      };

      if (input.members && input.members.length > 0) {
        requestBody.members = input.members.map(member => ({
          '@odata.type': '#microsoft.graph.aadUserConversationMember',
          roles: member.roles?.includes('owner') ? ['owner'] : [],
          'user@odata.bind': `https://graph.microsoft.com/v1.0/users('${member.user_id}')`,
        }));
      }

      if (input.channels && input.channels.length > 0) {
        requestBody.channels = input.channels.map(channel => ({
          displayName: channel.display_name,
          ...(channel.description !== undefined && { description: channel.description }),
          ...(channel.is_favorite_by_default !== undefined && { isFavoriteByDefault: channel.is_favorite_by_default }),
          ...(channel.tabs &&
            channel.tabs.length > 0 && {
              tabs: channel.tabs.map(tab => ({
                'teamsApp@odata.bind': `https://graph.microsoft.com/v1.0/appCatalogs/teamsApps('${tab.teams_app_id}')`,
                displayName: tab.display_name,
                configuration: {
                  contentUrl: tab.configuration.content_url,
                  ...(tab.configuration.website_url !== undefined && { websiteUrl: tab.configuration.website_url }),
                },
              })),
            }),
        }));
      }

      if (input.member_settings) {
        requestBody.memberSettings = {
          ...(input.member_settings.allow_create_update_channels !== undefined && {
            allowCreateUpdateChannels: input.member_settings.allow_create_update_channels,
          }),
          ...(input.member_settings.allow_delete_channels !== undefined && {
            allowDeleteChannels: input.member_settings.allow_delete_channels,
          }),
          ...(input.member_settings.allow_add_remove_apps !== undefined && {
            allowAddRemoveApps: input.member_settings.allow_add_remove_apps,
          }),
          ...(input.member_settings.allow_create_update_remove_tabs !== undefined && {
            allowCreateUpdateRemoveTabs: input.member_settings.allow_create_update_remove_tabs,
          }),
          ...(input.member_settings.allow_create_update_remove_connectors !== undefined && {
            allowCreateUpdateRemoveConnectors: input.member_settings.allow_create_update_remove_connectors,
          }),
        };
      }

      if (input.guest_settings) {
        requestBody.guestSettings = {
          ...(input.guest_settings.allow_create_update_channels !== undefined && {
            allowCreateUpdateChannels: input.guest_settings.allow_create_update_channels,
          }),
          ...(input.guest_settings.allow_delete_channels !== undefined && {
            allowDeleteChannels: input.guest_settings.allow_delete_channels,
          }),
        };
      }

      if (input.fun_settings) {
        requestBody.funSettings = {
          ...(input.fun_settings.allow_giphy !== undefined && { allowGiphy: input.fun_settings.allow_giphy }),
          ...(input.fun_settings.giphy_content_rating !== undefined && {
            giphyContentRating: input.fun_settings.giphy_content_rating,
          }),
          ...(input.fun_settings.allow_stickers_and_memes !== undefined && {
            allowStickersAndMemes: input.fun_settings.allow_stickers_and_memes,
          }),
          ...(input.fun_settings.allow_custom_memes !== undefined && {
            allowCustomMemes: input.fun_settings.allow_custom_memes,
          }),
        };
      }

      if (input.messaging_settings) {
        requestBody.messagingSettings = {
          ...(input.messaging_settings.allow_user_edit_messages !== undefined && {
            allowUserEditMessages: input.messaging_settings.allow_user_edit_messages,
          }),
          ...(input.messaging_settings.allow_user_delete_messages !== undefined && {
            allowUserDeleteMessages: input.messaging_settings.allow_user_delete_messages,
          }),
          ...(input.messaging_settings.allow_owner_delete_messages !== undefined && {
            allowOwnerDeleteMessages: input.messaging_settings.allow_owner_delete_messages,
          }),
          ...(input.messaging_settings.allow_team_mentions !== undefined && {
            allowTeamMentions: input.messaging_settings.allow_team_mentions,
          }),
          ...(input.messaging_settings.allow_channel_mentions !== undefined && {
            allowChannelMentions: input.messaging_settings.allow_channel_mentions,
          }),
        };
      }

      if (input.discovery_settings) {
        requestBody.discoverySettings = {
          ...(input.discovery_settings.show_in_teams_search_and_suggestions !== undefined && {
            showInTeamsSearchAndSuggestions: input.discovery_settings.show_in_teams_search_and_suggestions,
          }),
        };
      }

      if (input.installed_apps && input.installed_apps.length > 0) {
        requestBody.installedApps = input.installed_apps.map(app => ({
          'teamsApp@odata.bind': `https://graph.microsoft.com/v1.0/appCatalogs/teamsApps('${app.teams_app_id}')`,
        }));
      }

      const createResponse = await platformProxy.post({
        // https://learn.microsoft.com/graph/api/team-post
        endpoint: '/v1.0/teams',
        data: requestBody,
        retries: 3,
      });

      if (createResponse.status !== 200 && createResponse.status !== 202) {
        throw new platformProxy.ActionError({
          type: 'unexpected_response',
          message: `Expected 200 OK or 202 Accepted, got ${createResponse.status}`,
          response: createResponse.data,
        });
      }

      const headers = createResponse.headers;
      const locationHeader = typeof headers['location'] === 'string' ? headers['location'] : undefined;
      const contentLocationHeader =
        typeof headers['content-location'] === 'string' ? headers['content-location'] : undefined;

      const teamIdMatch = contentLocationHeader?.match(/teams\('([^']+)'\)/);
      let teamId = teamIdMatch ? teamIdMatch[1] : undefined;

      if (
        createResponse.status === 200 &&
        createResponse.data &&
        typeof createResponse.data === 'object' &&
        !Array.isArray(createResponse.data)
      ) {
        const providerTeamData = createResponse.data;
        if ('id' in providerTeamData && typeof providerTeamData.id === 'string') {
          teamId = providerTeamData.id;
        }
      }

      const operationIdMatch = locationHeader?.match(/operations\('([^']+)'\)/);
      const operationId = operationIdMatch ? operationIdMatch[1] : undefined;

      if (!locationHeader || !operationId) {
        if (teamId) {
          return {
            team_id: teamId,
            operation_id: 'unknown',
            operation_url: contentLocationHeader || locationHeader || '/v1.0/teams',
            status: 'succeeded',
          };
        }
        return {
          operation_id: 'unknown',
          operation_url: '/v1.0/teams',
          status: 'notStarted',
        };
      }

      const operationResponse = await platformProxy.get({
        // https://learn.microsoft.com/graph/api/teamsasyncoperation-get
        endpoint: locationHeader.startsWith('/v1.0/') ? locationHeader : `/v1.0${locationHeader}`,
        retries: 3,
      });

      const operation = ProviderAsyncOperationSchema.parse(operationResponse.data);

      return {
        ...(teamId && { team_id: teamId }),
        operation_id: operationId,
        operation_url: locationHeader,
        status: operation.status,
        ...(operation.error && { error: operation.error }),
      };
    },
  });
}
