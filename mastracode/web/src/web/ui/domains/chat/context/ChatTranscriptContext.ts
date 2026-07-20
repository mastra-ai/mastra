import type { AgentControllerTaskSnapshot, MastraDBMessage } from '@mastra/client-js';
import { createContext } from 'react';

import type { SessionStateSnapshot } from '../hooks/useAgentControllerTranscript';
import type {
  NoticeEntry,
  NotificationEntry,
  NotificationSummaryEntry,
  OutgoingFile,
  PromptEntry,
  SubagentEntry,
} from '../services/chatState';

export interface ChatTranscriptApi {
  messages: MastraDBMessage[];
  prompts: PromptEntry[];
  notices: NoticeEntry[];
  notifications: NotificationEntry[];
  notificationSummaries: NotificationSummaryEntry[];
  subagents: SubagentEntry[];
  tasks: AgentControllerTaskSnapshot[];
  pending: boolean;
  threadId?: string;
  workspaceReady?: boolean;
  busy: boolean;
  showWorkingIndicator: boolean;
  localUser: (text: string, steer?: boolean, files?: OutgoingFile[]) => void;
  reset: (threadId?: string, state?: SessionStateSnapshot, messages?: MastraDBMessage[]) => void;
  resolvePrompt: (id: string) => void;
  clearPending: () => void;
  pushNotice: (text: string, level?: 'info' | 'error') => void;
}

export const ChatTranscriptContext = createContext<ChatTranscriptApi | null>(null);
