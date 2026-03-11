import { useMemo } from 'react';
import { v4 as uuid } from '@lukeed/uuid';

import { Txt } from '@/ds/components/Txt';
import { AgentChat } from '../agent-chat';
import { AgentSettingsProvider } from '../../context/agent-context';
import { DatasetSaveProvider } from '@/lib/ai-ui/context/dataset-save-context';
import { useMergedRequestContext } from '@/domains/request-context/context/schema-request-context';

interface AgentPlaygroundTestChatProps {
  agentId: string;
  agentName?: string;
  modelVersion?: string;
  hasMemory: boolean;
}

export function AgentPlaygroundTestChat({ agentId, agentName, modelVersion, hasMemory }: AgentPlaygroundTestChatProps) {
  // Generate a stable ephemeral thread ID for test chat sessions
  const testThreadId = useMemo(() => uuid(), [agentId]);
  const mergedRequestContext = useMergedRequestContext();
  const hasRequestContext = Object.keys(mergedRequestContext).length > 0;

  return (
    <AgentSettingsProvider agentId={agentId} defaultSettings={{ modelSettings: {} }}>
      <DatasetSaveProvider
        enabled
        threadId={testThreadId}
        agentId={agentId}
        requestContext={hasRequestContext ? mergedRequestContext : undefined}
      >
        <div className="flex flex-col h-full">
          <div className="px-4 py-2 border-b border-border1">
            <Txt variant="ui-xs" className="text-neutral2">
              Test your agent configuration changes here. This uses the latest saved draft.
            </Txt>
          </div>
          <div className="flex-1 min-h-0">
            <AgentChat
              key={testThreadId}
              agentId={agentId}
              agentName={agentName}
              modelVersion={modelVersion}
              threadId={testThreadId}
              memory={hasMemory}
              refreshThreadList={async () => {}}
              isNewThread
            />
          </div>
        </div>
      </DatasetSaveProvider>
    </AgentSettingsProvider>
  );
}
