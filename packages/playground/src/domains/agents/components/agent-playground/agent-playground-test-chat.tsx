import { AgentSettingsProvider } from '../../context/agent-context';
import { BrowserSessionProvider } from '../../context/browser-session-context';
import { AgentChat } from '../agent-chat';
import { useMergedRequestContext } from '@/domains/request-context/context/schema-request-context';
import { DatasetSaveProvider } from '@/lib/ai-ui/context/dataset-save-context';

interface AgentPlaygroundTestChatProps {
  agentId: string;
  agentName?: string;
  modelVersion?: string;
  agentVersionId?: string;
  hasMemory: boolean;
}

export function AgentPlaygroundTestChat({
  agentId,
  agentName,
  modelVersion,
  agentVersionId,
  hasMemory,
}: AgentPlaygroundTestChatProps) {
  const mergedRequestContext = useMergedRequestContext();
  const hasRequestContext = Object.keys(mergedRequestContext).length > 0;

  return (
    <AgentSettingsProvider agentId={agentId} defaultSettings={{ modelSettings: {} }}>
      <BrowserSessionProvider agentId={agentId} threadId={agentId}>
        <DatasetSaveProvider
          enabled
          threadId={agentId}
          agentId={agentId}
          requestContext={hasRequestContext ? mergedRequestContext : undefined}
        >
          <div className="flex flex-col h-full">
            <div className="flex-1 min-h-0">
              <AgentChat
                key={agentId}
                agentId={agentId}
                agentName={agentName}
                modelVersion={modelVersion}
                agentVersionId={agentVersionId}
                threadId={agentId}
                memory={hasMemory}
                refreshThreadList={async () => {}}
                isNewThread
              />
            </div>
          </div>
        </DatasetSaveProvider>
      </BrowserSessionProvider>
    </AgentSettingsProvider>
  );
}
