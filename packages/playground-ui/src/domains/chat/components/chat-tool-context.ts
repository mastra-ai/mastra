import type { AskUserAnswer } from '../../../ds/components/ai/ask-user';
import type { MessageMetadata } from '../messages/message-metadata';
import type { AgentMessage } from './agent-message';
import type { BackgroundTaskDetails } from './background-task-metadata-dialog';
import type { McpAppViewerProps } from './mcp-app-viewer';
import type { PendingPlanCardProps } from './plan-card';
import type { WorkflowMessageData } from './workflow-message';

export interface ChatToolAction {
  toolCallId: string;
  toolName: string;
  metadata?: MessageMetadata;
}

export interface ChatToolData {
  isSubmitting?: boolean;
  approvalStatus?: 'approved' | 'declined';
  backgroundTask?: BackgroundTaskDetails;
  agent?: { messages: AgentMessage[]; isLoading?: boolean };
  plan?: Pick<PendingPlanCardProps, 'content' | 'isLoading' | 'isError'>;
  mcpApp?: Pick<McpAppViewerProps, 'html' | 'sandboxUrl'> & { isLoading?: boolean };
  workflow?: WorkflowMessageData;
}

export interface ChatToolContext {
  isRunning: boolean;
  toolData?: Readonly<Record<string, ChatToolData>>;
  mcpAppTools?: Readonly<Record<string, unknown>>;
  onApprove?: (tool: ChatToolAction) => void;
  onDecline?: (tool: ChatToolAction) => void;
  onAnswer?: (tool: ChatToolAction, answer: AskUserAnswer) => void;
  onApprovePlan?: (tool: ChatToolAction, path: string) => void;
  onRejectPlan?: (tool: ChatToolAction, path: string) => void;
  onToolOpen?: (toolCallId: string) => void;
  onNavigate?: (href: string) => void;
  onMcpToolCall?: (tool: ChatToolAction, name: string, args: Record<string, unknown>) => Promise<unknown>;
  onMcpSendMessage?: (tool: ChatToolAction, text: string) => Promise<void>;
}
