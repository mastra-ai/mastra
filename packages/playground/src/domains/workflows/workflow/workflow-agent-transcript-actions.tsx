import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@mastra/playground-ui';
import { MessageSquare } from 'lucide-react';
import { useMemo, useState } from 'react';
import { AgentChat } from '@/domains/agents/components/agent-chat';
import { ActivatedSkillsProvider } from '@/domains/agents/context/activated-skills-context';
import { AgentSettingsProvider } from '@/domains/agents/context/agent-context';
import { ObservationalMemoryProvider } from '@/domains/agents/context/agent-observational-memory-context';
import { WorkingMemoryProvider } from '@/domains/agents/context/agent-working-memory-context';
import { useAgent } from '@/domains/agents/hooks/use-agent';
import { ThreadInputProvider } from '@/domains/conversation/context/ThreadInputContext';
import { TracingSettingsProvider } from '@/domains/observability/context/tracing-settings-context';
import { SchemaRequestContextProvider } from '@/domains/request-context/context/schema-request-context';
import { useLinkComponent } from '@/lib/framework';
import type { AgentSettingsType } from '@/types';

export function WorkflowAgentTranscriptActions({ agentId, threadId }: { agentId: string; threadId: string }) {
  const { Link, paths } = useLinkComponent();
  const [previewOpen, setPreviewOpen] = useState(false);
  const { data: agent } = useAgent(agentId);

  const chatPath = paths.agentThreadLink(agentId, threadId);

  return (
    <>
      <Button
        as={Link}
        to={chatPath}
        size="sm"
        variant="outline"
        tooltip="Open this step's transcript on the agent page"
      >
        <span className="inline-flex items-center gap-1.5">
          <MessageSquare className="size-3.5 opacity-80" aria-hidden />
          Open chat
        </span>
      </Button>
      <Button size="sm" variant="outline" onClick={() => setPreviewOpen(true)} tooltip="Preview messages in a dialog">
        Preview
      </Button>
      <WorkflowAgentTranscriptPreviewDialog
        agent={agent}
        agentId={agentId}
        threadId={threadId}
        open={previewOpen}
        onOpenChange={setPreviewOpen}
      />
    </>
  );
}

function WorkflowAgentTranscriptPreviewDialog({
  agent,
  agentId,
  threadId,
  open,
  onOpenChange,
}: {
  agent: ReturnType<typeof useAgent>['data'];
  agentId: string;
  threadId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const defaultSettings = useMemo((): AgentSettingsType => {
    if (!agent) {
      return { modelSettings: {} };
    }
    const agentDefaultOptions = agent.defaultOptions as
      | {
          maxSteps?: number;
          modelSettings?: Record<string, unknown>;
          providerOptions?: AgentSettingsType['modelSettings']['providerOptions'];
        }
      | undefined;
    const { maxOutputTokens, ...restModelSettings } = (agentDefaultOptions?.modelSettings ?? {}) as {
      maxOutputTokens?: number;
      [key: string]: unknown;
    };
    return {
      modelSettings: {
        ...(restModelSettings as AgentSettingsType['modelSettings']),
        ...(maxOutputTokens !== undefined && { maxTokens: maxOutputTokens }),
        ...(agentDefaultOptions?.maxSteps !== undefined && { maxSteps: agentDefaultOptions.maxSteps }),
        ...(agentDefaultOptions?.providerOptions !== undefined && {
          providerOptions: agentDefaultOptions.providerOptions,
        }),
      },
    };
  }, [agent]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-[95vw] h-[min(88vh,920px)] flex flex-col p-0 gap-0">
        <DialogHeader className="px-4 pt-4 pb-3 shrink-0 border-b border-border1">
          <DialogTitle>Agent transcript</DialogTitle>
          <DialogDescription>
            Read-only preview of the same chat thread for agent{' '}
            <span className="font-mono text-neutral4">{agentId}</span>.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="flex-1 min-h-0 overflow-hidden flex flex-col px-0 pb-4 pt-0">
          <TracingSettingsProvider entityId={agentId} entityType="agent">
            <AgentSettingsProvider agentId={agentId} defaultSettings={defaultSettings}>
              <SchemaRequestContextProvider>
                <WorkingMemoryProvider agentId={agentId} threadId={threadId} resourceId={agentId}>
                  <ThreadInputProvider>
                    <ObservationalMemoryProvider>
                      <ActivatedSkillsProvider>
                        <div className="h-[min(72vh,780px)] min-h-[420px] overflow-hidden border-t border-border1 bg-surface1">
                          <AgentChat
                            agentId={agentId}
                            agentName={agent?.name}
                            modelVersion={agent?.modelVersion}
                            threadId={threadId}
                            memory
                            hideModelSwitcher
                          />
                        </div>
                      </ActivatedSkillsProvider>
                    </ObservationalMemoryProvider>
                  </ThreadInputProvider>
                </WorkingMemoryProvider>
              </SchemaRequestContextProvider>
            </AgentSettingsProvider>
          </TracingSettingsProvider>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
