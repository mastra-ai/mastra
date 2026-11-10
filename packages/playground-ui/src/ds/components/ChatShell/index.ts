import {
  ChatShellBar,
  ChatShellColumn,
  ChatShellContent,
  ChatShellDock,
  ChatShellRoot,
  ChatShellScrollButton,
  ChatShellStage,
  ChatShellTranscript,
  ChatShellTurn,
  ChatShellViewport,
} from './chat-shell';

export type { ChatShellProps, ChatShellTurnProps } from './chat-shell';

export const ChatShell = Object.assign(ChatShellRoot, {
  Bar: ChatShellBar,
  Column: ChatShellColumn,
  Content: ChatShellContent,
  Dock: ChatShellDock,
  ScrollButton: ChatShellScrollButton,
  Stage: ChatShellStage,
  Transcript: ChatShellTranscript,
  Turn: ChatShellTurn,
  Viewport: ChatShellViewport,
});
