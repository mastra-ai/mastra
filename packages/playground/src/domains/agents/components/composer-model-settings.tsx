import { useAgentSettings } from '../context/agent-context';
import { useAgent } from '../hooks/use-agent';
import { useSamplingRestriction } from '../hooks/use-sampling-restriction';
import { ComposerModelSettingsView } from './composer-model-settings-view';
import type { ModelSettingsMethod } from './composer-run-settings';
import { ComposerRunSettings } from './composer-run-settings';
import { usePermissions } from '@/domains/auth/hooks/use-permissions';
import { useMemory } from '@/domains/memory/hooks/use-memory';

export interface ComposerModelSettingsProps {
  agentId: string;
}

export const ComposerModelSettings = ({ agentId }: ComposerModelSettingsProps) => {
  const { data: agent, isLoading } = useAgent(agentId);
  const { data: memory, isLoading: isMemoryLoading } = useMemory(agentId);
  const { settings, setSettings, resetAll } = useAgentSettings();
  const { canEdit } = usePermissions();

  const canEditSettings = canEdit('agents');

  const { hasSamplingRestriction } = useSamplingRestriction({
    provider: agent?.provider,
    modelId: agent?.modelId,
    settings,
    setSettings,
  });

  if (!isLoading && !agent) {
    return null;
  }

  const hasMemory = Boolean(memory?.result);
  const hasSubAgents = Boolean(agent && Object.keys(agent.agents || {}).length > 0);
  const modelVersion = agent?.modelVersion;
  const isSupportedModel = modelVersion === 'v2' || modelVersion === 'v3';
  const supportsThreadSubscription = agent?.supportsMemory !== false;

  let radioValue: string | undefined;

  if (agent) {
    if (isSupportedModel) {
      if (settings?.modelSettings?.chatWithNetwork) {
        radioValue = 'network';
      } else if (settings?.modelSettings?.chatWithGenerate) {
        radioValue = 'generate';
      } else if (settings?.modelSettings?.chatWithLegacyStream || !supportsThreadSubscription) {
        radioValue = 'stream';
      } else {
        radioValue = 'streamSubscription';
      }
    } else {
      radioValue = settings?.modelSettings?.chatWithGenerateLegacy ? 'generateLegacy' : 'streamLegacy';
    }
  }

  const showSamplingBanner =
    hasSamplingRestriction &&
    (settings?.modelSettings?.temperature !== undefined || settings?.modelSettings?.topP !== undefined);

  const networkRequirements = [!hasMemory && 'memory enabled', !hasSubAgents && 'at least one sub-agent'].filter(
    Boolean,
  );
  const methods: ModelSettingsMethod[] = isSupportedModel
    ? [
        { value: 'generate', label: 'Generate' },
        {
          value: 'streamSubscription',
          label: 'Stream subscription (default)',
          unavailable: supportsThreadSubscription ? undefined : 'Stream subscription is not supported for this agent.',
        },
        { value: 'stream', label: 'Stream' },
        {
          value: 'network',
          label: 'Network',
          unavailable: networkRequirements.length
            ? `Network is not available. Please make sure you have ${networkRequirements.join(' and ')}.`
            : undefined,
        },
      ]
    : [
        { value: 'generateLegacy', label: 'Generate (Legacy)' },
        { value: 'streamLegacy', label: 'Stream (Legacy)' },
      ];
  const samplingNotice =
    settings?.modelSettings?.temperature !== undefined
      ? 'Claude 4.5+ models only accept Temperature OR Top P. Clear Temperature to use Top P.'
      : 'Claude 4.5+ models only accept Temperature OR Top P. Setting Temperature will clear Top P.';

  return (
    <ComposerModelSettingsView
      value={settings?.modelSettings ?? {}}
      onChange={value => setSettings({ ...settings, modelSettings: { ...settings?.modelSettings, ...value } })}
      onReset={resetAll}
      canEdit={canEditSettings}
      loading={isLoading || isMemoryLoading}
      samplingNotice={showSamplingBanner ? samplingNotice : undefined}
    >
      <ComposerRunSettings
        method={radioValue}
        methods={methods}
        onMethodChange={value =>
          setSettings({
            ...settings,
            modelSettings: {
              ...settings?.modelSettings,
              chatWithGenerateLegacy: value === 'generateLegacy',
              chatWithGenerate: value === 'generate',
              chatWithLegacyStream: value === 'stream',
              chatWithNetwork: value === 'network',
            },
          })
        }
        canEdit={canEditSettings}
        requireToolApproval={settings?.modelSettings?.requireToolApproval}
        onToolApprovalChange={requireToolApproval =>
          setSettings({ ...settings, modelSettings: { ...settings?.modelSettings, requireToolApproval } })
        }
      />
    </ComposerModelSettingsView>
  );
};
