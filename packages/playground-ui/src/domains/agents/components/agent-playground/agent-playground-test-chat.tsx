import { useMemo, useState } from 'react';
import { v4 as uuid } from '@lukeed/uuid';
import { Braces, ChevronDown } from 'lucide-react';

import { Txt } from '@/ds/components/Txt';
import { Icon } from '@/ds/icons/Icon';
import { cn } from '@/lib/utils';
import { AgentChat } from '../agent-chat';
import { AgentSettingsProvider } from '../../context/agent-context';
import { DatasetSaveProvider } from '@/lib/ai-ui/context/dataset-save-context';
import { useMergedRequestContext } from '@/domains/request-context/context/schema-request-context';
import { AgentPlaygroundRequestContext } from './agent-playground-request-context';

interface AgentPlaygroundTestChatProps {
  agentId: string;
  agentName?: string;
  modelVersion?: string;
  hasMemory: boolean;
  requestContextSchema?: string;
}

export function AgentPlaygroundTestChat({
  agentId,
  agentName,
  modelVersion,
  hasMemory,
  requestContextSchema,
}: AgentPlaygroundTestChatProps) {
  // Generate a stable ephemeral thread ID for test chat sessions
  const testThreadId = useMemo(() => uuid(), [agentId]);
  const mergedRequestContext = useMergedRequestContext();
  const hasRequestContext = Object.keys(mergedRequestContext).length > 0;

  const [showRequestContext, setShowRequestContext] = useState(false);

  return (
    <AgentSettingsProvider agentId={agentId} defaultSettings={{ modelSettings: {} }}>
      <DatasetSaveProvider
        enabled
        threadId={testThreadId}
        agentId={agentId}
        requestContext={hasRequestContext ? mergedRequestContext : undefined}
      >
        <div className="flex flex-col h-full">
          {/* Collapsible request context */}
          <button
            type="button"
            onClick={() => setShowRequestContext(prev => !prev)}
            className="flex items-center gap-1.5 px-4 py-2 border-b border-border1 hover:bg-surface2 transition-colors"
          >
            <Icon size="sm"><Braces /></Icon>
            <Txt variant="ui-sm" className="text-neutral3">
              Request Context
            </Txt>
            <ChevronDown
              className={cn(
                'h-3.5 w-3.5 text-neutral3 transition-transform ml-auto',
                showRequestContext && 'rotate-180',
              )}
            />
          </button>
          {showRequestContext && (
            <div className="border-b border-border1 max-h-[40%] overflow-auto">
              <AgentPlaygroundRequestContext requestContextSchema={requestContextSchema} />
            </div>
          )}

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
