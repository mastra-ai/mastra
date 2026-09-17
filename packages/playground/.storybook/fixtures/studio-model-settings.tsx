import { useState } from 'react';
import { ComposerModelSettingsView as ModelSettings } from '../../src/domains/agents/components/composer-model-settings-view';
import { ComposerRunSettings } from '../../src/domains/agents/components/composer-run-settings';
import type { ModelSettings as ModelSettingsValues } from '../../src/types';

const methods = [
  { value: 'generate', label: 'Generate' },
  { value: 'streamSubscription', label: 'Stream subscription (default)' },
  { value: 'stream', label: 'Stream' },
  {
    value: 'network',
    label: 'Network',
    unavailable: 'Network is not available. Please make sure you have at least one sub-agent.',
  },
];

export function StudioModelSettings({ loading }: { loading: boolean }) {
  const [requireToolApproval, setRequireToolApproval] = useState(false);
  const [method, setMethod] = useState('streamSubscription');
  const [settings, setSettings] = useState<ModelSettingsValues>({});
  return (
    <ModelSettings
      loading={loading}
      value={settings}
      onChange={setSettings}
      onReset={() => {
        setSettings({});
        setMethod('streamSubscription');
        setRequireToolApproval(false);
      }}
    >
      <ComposerRunSettings
        method={method}
        methods={methods}
        onMethodChange={setMethod}
        requireToolApproval={requireToolApproval}
        onToolApprovalChange={setRequireToolApproval}
      />
    </ModelSettings>
  );
}
