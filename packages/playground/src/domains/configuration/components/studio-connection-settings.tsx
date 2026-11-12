import { SettingsGroup, SettingsTitle } from '@mastra/playground-ui/new/settings';
import { useStudioConfig } from '../context/studio-config-state';
import { StudioConnectionForm } from './studio-connection-form';

/**
 * Where Studio sends its requests: the instance URL, its API prefix and the headers sent with every request. The
 * form keeps a draft of them; it's keyed by the stored config, so it starts over from the stored values whenever
 * they change (they load after the first render, and saving writes them back).
 */
export function StudioConnectionSettings() {
  const { baseUrl, apiPrefix, headers } = useStudioConfig();
  const configKey = JSON.stringify([baseUrl, apiPrefix ?? '', headers]);

  return (
    <SettingsGroup>
      <SettingsTitle info="The Mastra instance the studio talks to, the path in front of its API routes, and the headers sent with every request.">
        Mastra connection
      </SettingsTitle>
      <StudioConnectionForm key={configKey} initialConfig={{ baseUrl, apiPrefix, headers }} />
    </SettingsGroup>
  );
}
