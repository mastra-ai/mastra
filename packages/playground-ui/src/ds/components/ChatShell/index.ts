import {
  ChatShellBar,
  ChatShellColumn,
  ChatShellContent,
  ChatShellDock,
  ChatShellRoot,
  ChatShellScrollButton,
  ChatShellStage,
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
  Turn: ChatShellTurn,
  Viewport: ChatShellViewport,
});
