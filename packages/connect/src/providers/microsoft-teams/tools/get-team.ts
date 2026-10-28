// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getTeamInputSchema = z.object({
  teamId: z.string().describe('The unique identifier of the team. Example: "893075dd-2487-4122-925f-022c42e20265"'),
});

const TeamFunSettingsSchema = z.object({
  allowGiphy: z.boolean().optional(),
  giphyContentRating: z.string().optional(),
  allowStickersAndMemes: z.boolean().optional(),
  allowCustomMemes: z.boolean().optional(),
});

const TeamGuestSettingsSchema = z.object({
  allowCreateUpdateChannels: z.boolean().optional(),
  allowDeleteChannels: z.boolean().optional(),
});

const TeamMemberSettingsSchema = z.object({
  allowCreateUpdateChannels: z.boolean().optional(),
  allowDeleteChannels: z.boolean().optional(),
  allowAddRemoveApps: z.boolean().optional(),
  allowCreateUpdateRemoveTabs: z.boolean().optional(),
  allowCreateUpdateRemoveConnectors: z.boolean().optional(),
});

const TeamMessagingSettingsSchema = z.object({
  allowUserEditMessages: z.boolean().optional(),
  allowUserDeleteMessages: z.boolean().optional(),
  allowOwnerDeleteMessages: z.boolean().optional(),
  allowTeamMentions: z.boolean().optional(),
  allowChannelMentions: z.boolean().optional(),
});

const TeamDiscoverySettingsSchema = z.object({
  showInTeamsSearchAndSuggestions: z.boolean().optional(),
});

const TeamSummarySchema = z.object({
  ownersCount: z.number().optional(),
  membersCount: z.number().optional(),
  guestsCount: z.number().optional(),
});

const ProviderTeamSchema = z.object({
  id: z.string().optional(),
  displayName: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  classification: z.string().optional().nullable(),
  visibility: z.string().optional().nullable(),
  isArchived: z.boolean().optional(),
  createdDateTime: z.string().optional().nullable(),
  internalId: z.string().optional().nullable(),
  tenantId: z.string().optional().nullable(),
  webUrl: z.string().optional().nullable(),
  funSettings: TeamFunSettingsSchema.optional().nullable(),
  guestSettings: TeamGuestSettingsSchema.optional().nullable(),
  memberSettings: TeamMemberSettingsSchema.optional().nullable(),
  messagingSettings: TeamMessagingSettingsSchema.optional().nullable(),
  discoverySettings: TeamDiscoverySettingsSchema.optional().nullable(),
  summary: TeamSummarySchema.optional().nullable(),
});

export const getTeamOutputSchema = z.object({
  id: z.string(),
  displayName: z.string().optional(),
  description: z.string().optional(),
  classification: z.string().optional(),
  visibility: z.string().optional(),
  isArchived: z.boolean().optional(),
  createdDateTime: z.string().optional(),
  internalId: z.string().optional(),
  tenantId: z.string().optional(),
  webUrl: z.string().optional(),
  funSettings: TeamFunSettingsSchema.optional(),
  guestSettings: TeamGuestSettingsSchema.optional(),
  memberSettings: TeamMemberSettingsSchema.optional(),
  messagingSettings: TeamMessagingSettingsSchema.optional(),
  discoverySettings: TeamDiscoverySettingsSchema.optional(),
  summary: TeamSummarySchema.optional(),
});

export function getTeamTool(proxy: PlatformProxy) {
  return createTool({
    id: 'microsoft_teams_get_team',
    description: 'Retrieve a team by ID.',
    inputSchema: getTeamInputSchema,
    outputSchema: getTeamOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getTeamOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://learn.microsoft.com/en-us/graph/api/team-get
      const response = await platformProxy.get({
        endpoint: `/v1.0/teams/${input.teamId}`,
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Team not found',
          teamId: input.teamId,
        });
      }

      const providerTeam = ProviderTeamSchema.parse(response.data);

      return {
        id: providerTeam.id || input.teamId,
        ...(providerTeam.displayName != null && { displayName: providerTeam.displayName }),
        ...(providerTeam.description != null && { description: providerTeam.description }),
        ...(providerTeam.classification != null && { classification: providerTeam.classification }),
        ...(providerTeam.visibility != null && { visibility: providerTeam.visibility }),
        ...(providerTeam.isArchived !== undefined && { isArchived: providerTeam.isArchived }),
        ...(providerTeam.createdDateTime != null && { createdDateTime: providerTeam.createdDateTime }),
        ...(providerTeam.internalId != null && { internalId: providerTeam.internalId }),
        ...(providerTeam.tenantId != null && { tenantId: providerTeam.tenantId }),
        ...(providerTeam.webUrl != null && { webUrl: providerTeam.webUrl }),
        ...(providerTeam.funSettings != null && { funSettings: providerTeam.funSettings }),
        ...(providerTeam.guestSettings != null && { guestSettings: providerTeam.guestSettings }),
        ...(providerTeam.memberSettings != null && { memberSettings: providerTeam.memberSettings }),
        ...(providerTeam.messagingSettings != null && { messagingSettings: providerTeam.messagingSettings }),
        ...(providerTeam.discoverySettings != null && { discoverySettings: providerTeam.discoverySettings }),
        ...(providerTeam.summary != null && { summary: providerTeam.summary }),
      };
    },
  });
}
