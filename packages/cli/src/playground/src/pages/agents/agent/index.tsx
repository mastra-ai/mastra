import { AgentProvider, AgentChat as Chat, MainContent, MainColumn, MainHeader, Button } from '@mastra/playground-ui';
import { useEffect, useState } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router';
// import { v4 as uuid } from '@lukeed/uuid';

import { AgentHeader } from '@/domains/agents/agent-header';
import { AgentInformation } from '@/domains/agents/agent-information';
import { useAgent } from '@/hooks/use-agents';
import { useMemory, useMessages, useThreads } from '@/hooks/use-memory';
import type { Message } from '@/types';
import { useFeatureFlagEnabled } from 'posthog-js/react';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SelectLabel } from '@radix-ui/react-select';
import { AgentLogs } from '@/domains/agents/agent-logs';
import { AgentVersions } from '@/domains/agents/agent-versions';

function Agent() {
  const isCliShowMultiModal = useFeatureFlagEnabled('cli_ShowMultiModal');

  const { agentId, threadId } = useParams();
  const { agent, isLoading: isAgentLoading } = useAgent(agentId!);
  const { memory } = useMemory(agentId!);
  const navigate = useNavigate();
  const location = useLocation();
  const { messages, isLoading: isMessagesLoading } = useMessages({
    agentId: agentId!,
    threadId: threadId!,
    memory: !!memory?.result,
  });
  const [sidebar] = useState(true);
  const {
    threads,
    isLoading: isThreadsLoading,
    mutate: refreshThreads,
  } = useThreads({ resourceid: agentId!, agentId: agentId!, isMemoryEnabled: !!memory?.result });

  const [content, setContent] = useState<'default' | 'log-drains' | 'versions'>('default');

  console.log({ threads });

  useEffect(() => {
    const path = location.pathname;
    if (path.includes('/log-drains')) {
      setContent('log-drains');
    } else if (path.includes('/versions')) {
      setContent('versions');
    } else {
      setContent('default');
    }
  }, [location.pathname]);

  // useEffect(() => {
  //   if (memory?.result && !threadId) {
  //     // use @lukeed/uuid because we don't need a cryptographically secure uuid (this is a debugging local uuid)
  //     // using crypto.randomUUID() on a domain without https (ex a local domain like local.lan:4111) will cause a TypeError
  //     navigate(`/agents/${agentId}/chat/${uuid()}`);
  //   }
  // }, [memory?.result, threadId]);

  if (isAgentLoading) {
    return null;
  }

  return (
    <AgentProvider
      agentId={agentId!}
      defaultGenerateOptions={agent?.defaultGenerateOptions}
      defaultStreamOptions={agent?.defaultStreamOptions}
    >
      <MainColumn style={{ gridRow: 'span 2' }}>
        <div className="h-full grid grid-rows-[auto_1fr]">
          <div className="pb-6 grid grid-cols-[2fr_1fr] gap-5">
            <Select>
              <SelectTrigger>
                <SelectValue placeholder="Select a thread" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Threads</SelectLabel>
                  {threads?.map(thread => (
                    <SelectItem key={thread.id} value={thread.id}>
                      {thread.title}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <Button
              variant="default"
              size="lg"
              onClick={() => {
                console.log('New chat');
              }}
            >
              New chat
            </Button>
          </div>
          <div className="grid overflow-y-auto relative bg-surface3 py-6 border-sm rounded-lg ">
            <Chat
              agentId={agentId!}
              agentName={agent?.name}
              threadId={threadId!}
              initialMessages={isMessagesLoading ? undefined : (messages as Message[])}
              memory={memory?.result}
              refreshThreadList={refreshThreads}
              showFileSupport={isCliShowMultiModal}
            />
          </div>
        </div>
      </MainColumn>
      <MainColumn variant="withHeader">
        {content === 'default' && <AgentInformation agentId={agentId!} />}
        {content === 'log-drains' && <AgentLogs agentId={agentId!} />}
        {content === 'versions' && <AgentVersions agentId={agentId!} />}
      </MainColumn>
    </AgentProvider>
  );
}

export default Agent;
