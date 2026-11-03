import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import {
  getSlackToolSettings,
  joinSlackChannel,
  saveSlackToolSettings,
} from '../ui/domains/settings/services/slackToolSettings';
import type { SlackToolSettings, SlackToolSettingsPayload } from '../ui/domains/settings/services/slackToolSettings';

/** What a Factory's sessions may do in Slack, and the channels to pick from. */
export function useSlackToolSettingsQuery(factoryProjectId: string | undefined) {
  const { baseUrl } = useApiConfig();
  return useQuery({
    queryKey: queryKeys.slackToolSettings(factoryProjectId),
    queryFn: () => getSlackToolSettings(baseUrl, factoryProjectId!),
    enabled: Boolean(factoryProjectId),
  });
}

/**
 * Save a Factory's Slack settings. When `join` names a public channel the app
 * isn't in, the app joins it first, so a picked channel is one sessions can read.
 */
export function useSaveSlackToolSettingsMutation(factoryProjectId: string | undefined) {
  const { baseUrl } = useApiConfig();
  const queryClient = useQueryClient();
  const key = queryKeys.slackToolSettings(factoryProjectId);
  return useMutation({
    mutationFn: async ({ settings, join }: { settings: SlackToolSettings; join?: string }) => {
      if (join) await joinSlackChannel(baseUrl, factoryProjectId!, join);
      return saveSlackToolSettings(baseUrl, factoryProjectId!, settings);
    },
    onSuccess: (settings, { join }) => {
      queryClient.setQueryData<SlackToolSettingsPayload>(key, current =>
        current
          ? {
              ...current,
              settings,
              channels: current.channels.map(channel =>
                channel.id === join ? { ...channel, appIsMember: true } : channel,
              ),
            }
          : current,
      );
    },
  });
}
