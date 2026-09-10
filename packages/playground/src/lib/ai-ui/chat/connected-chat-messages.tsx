import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import { ChatMessages, getPlanDocument } from '@mastra/playground-ui/domains/chat';
import type { ChatMessagesProps, ChatToolAction } from '@mastra/playground-ui/domains/chat';
import { useMastraClient } from '@mastra/react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useDatasetSaveContext } from '../context/dataset-save-context';
import { DatasetSaveDialog } from '../messages/dataset-save-action';
import { readToolPart } from '../messages/renderers/tool-part';
import { isRecord } from '../messages/signal-data';
import { toolInteraction } from '../tools/tool-card-kind';
import { useChatRunning, useChatSend } from './chat-context';
import { CollectChatToolData } from './connected-tool-data';
import { useMcpAppTools } from '@/domains/mcps/hooks/use-mcp-app-tools';
import { useToolCall } from '@/services/tool-call-provider';

export function ConnectedChatMessages(
  props: Pick<ChatMessagesProps, 'messages' | 'hasModelList' | 'speakingMessageId' | 'onReadAloud' | 'onStopSpeaking'>,
) {
  const { isRunning } = useChatRunning();
  const send = useChatSend();
  const client = useMastraClient();
  const navigate = useNavigate();
  const approvals = useToolCall();
  const { data: mcpAppTools = {} } = useMcpAppTools();
  const dataset = useDatasetSaveContext();
  const [datasetInput, setDatasetInput] = useState('');
  const [datasetOpen, setDatasetOpen] = useState(false);
  const calls = props.messages.flatMap(message =>
    message.content.parts.flatMap(part => {
      if (part.type !== 'tool-invocation') return [];
      return [
        { ...readToolPart(part), metadata: isRecord(message.content.metadata) ? message.content.metadata : undefined },
      ];
    }),
  );
  const approve = ({ toolCallId, toolName, metadata }: ChatToolAction, decline = false) => {
    if (metadata?.mode === 'network') {
      const { approval } = toolInteraction(metadata, toolName, toolCallId);
      (decline ? approvals.declineNetworkToolcall : approvals.approveNetworkToolcall)(toolName, approval?.runId);
    } else if (metadata?.mode === 'generate') {
      (decline ? approvals.declineToolcallGenerate : approvals.approveToolcallGenerate)(toolCallId);
    } else {
      (decline ? approvals.declineToolcall : approvals.approveToolcall)(toolCallId);
    }
  };
  const save = (_message: MastraDBMessage, text: string) => {
    setDatasetInput(JSON.stringify(text, null, 2));
    setDatasetOpen(true);
  };
  return (
    <>
      <CollectChatToolData calls={calls} mcpAppTools={mcpAppTools}>
        {toolData => {
          const resumePlan = (tool: ChatToolAction, path: string, action: 'approved' | 'rejected') => {
            const content = toolData[tool.toolCallId]?.plan?.content;
            approvals.approveToolcall(tool.toolCallId, {
              action,
              path,
              ...(content ? { title: getPlanDocument(content).title, plan: content } : {}),
            });
          };
          return (
            <ChatMessages
              {...props}
              isRunning={isRunning}
              toolData={toolData}
              mcpAppTools={mcpAppTools}
              onApprove={tool => approve(tool)}
              onDecline={tool => approve(tool, true)}
              onAnswer={(tool, answer) => approvals.approveToolcall(tool.toolCallId, answer)}
              onApprovePlan={(tool, path) => resumePlan(tool, path, 'approved')}
              onRejectPlan={(tool, path) => resumePlan(tool, path, 'rejected')}
              onNavigate={navigate}
              onSaveToDataset={dataset?.enabled ? save : undefined}
              onMcpToolCall={async (tool, name, args) => {
                const app = mcpAppTools[tool.toolName];
                if (!app) throw new Error('MCP app is no longer available');
                return client.getMcpServerTool(app.serverId, name).execute({ data: args });
              }}
              onMcpSendMessage={async (_tool, text) => {
                send({ message: text });
              }}
            />
          );
        }}
      </CollectChatToolData>
      {dataset?.enabled && (
        <DatasetSaveDialog
          open={datasetOpen}
          onOpenChange={setDatasetOpen}
          input={datasetInput}
          onInputChange={setDatasetInput}
          requestContext={dataset.requestContext}
        />
      )}
    </>
  );
}
