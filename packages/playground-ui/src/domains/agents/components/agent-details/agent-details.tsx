import { useState } from 'react';
import { useAgentSettings } from '../../context/agent-context';
import { AgentDetailsView } from './agent-details-view';
import { AgentDetailsEdit } from './agent-details-edit';

type AgentDetailsProps = {
  LinkComponent: any;
  agentId?: string;
  agent?: any; // Optional agent prop for direct use in the component
};

export const AgentDetails = ({ LinkComponent, agentId, agent }: AgentDetailsProps) => {
  const [isEditMode, setIsEditMode] = useState(false);
  const { settings, setSettings, resetAll } = useAgentSettings();
  const prompt = agent?.instructions ? agent.instructions?.replace(/^\n/, '') : '';
  const modelSettings = settings?.modelSettings || {};
  const [isSaving, setIsSaving] = useState(false);

  console.log('modelSettings', modelSettings);

  const settingsData = [
    {
      label: 'Chat Method',
      key: 'chatWithGenerate',
      value: modelSettings?.chatWithGenerate ? 'generate' : 'stream',
      field: 'radio',
      layout: 'horizontal',
      options: [
        { value: 'generate', label: 'Generate' },
        { value: 'stream', label: 'Stream' },
      ],
    },
    {
      label: 'Temperature',
      key: 'temperature',
      value: modelSettings?.temperature ?? -0.1,
      field: 'slider',
      max: 1,
      min: -0.1,
      step: 0.1,
    },
    {
      label: 'Top P',
      key: 'topP',
      value: modelSettings?.topP ?? -0.1,
      field: 'slider',
      max: 1,
      min: -0.1,
      step: 0.1,
    },
    {
      label: 'Top K',
      key: 'topK',
      value: modelSettings?.topK,
      type: 'number',
    },
    {
      label: 'Frequency Penalty',
      key: 'frequencyPenalty',
      value: modelSettings?.frequencyPenalty,
      type: 'number',
    },
    {
      label: 'Presence Penalty',
      key: 'presencePenalty',
      value: modelSettings?.presencePenalty,
      type: 'number',
    },
    {
      label: 'Max Tokens',
      key: 'maxTokens',
      value: modelSettings?.maxTokens,
      type: 'number',
    },
    {
      label: 'Max Steps',
      key: 'maxSteps',
      value: modelSettings?.maxSteps,
      type: 'number',
    },
    {
      label: 'Max Retries',
      key: 'maxRetries',
      value: modelSettings?.maxRetries,
      type: 'number',
    },
    {
      label: 'Provider Options',
      key: 'providerOptions',
      value: modelSettings?.providerOptions,
      field: 'textarea',
    },
  ];

  const handleSave = (value: any) => {
    setIsEditMode(false);
    // Save logic here, e.g., update agent settings
  };

  return (
    <>
      {isEditMode ? (
        <AgentDetailsEdit
          currentVersion={'07/23/2025'}
          prompt={prompt}
          settings={settingsData}
          onCancel={() => {
            setIsEditMode(false);
            resetAll();
          }}
          isSaving={false}
          onSave={handleSave}
        />
      ) : (
        <AgentDetailsView
          prompt={prompt}
          settings={settingsData}
          LinkComponent={LinkComponent}
          versionOptions={[
            { value: '07/23/2025', label: '07/23/2024 at 10:05:03 AM - latest' },
            { value: '07/22/2025', label: '07/22/2024 at 9:25:03 AM' },
            { value: '07/21/2025', label: '07/21/2024 at 9:05:23 AM - test 12' },
            { value: '07/20/2025', label: '07/20/2024 at 8:45:12 AM' },
            { value: '07/19/2025', label: '07/19/2024 at 8:15:45 AM' },
          ]}
          currentVersion={'07/23/2025'}
          onVersionChange={e => console.log('Version changed')}
          onCustomizeClick={() => {
            setIsEditMode(true);
          }}
        />
      )}
    </>
  );
};
