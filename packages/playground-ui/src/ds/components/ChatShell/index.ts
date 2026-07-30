import {
  ChatShellBar,
  ChatShellColumn,
  ChatShellContent,
  ChatShellDock,
  ChatShellRoot,
  ChatShellScrollButton,
  ChatShellStage,
  ChatShellViewport,
} from './chat-shell';

export type { ChatShellProps } from './chat-shell';

export const ChatShell = Object.assign(ChatShellRoot, {
  Bar: ChatShellBar,
  Column: ChatShellColumn,
  Content: ChatShellContent,
  Dock: ChatShellDock,
  ScrollButton: ChatShellScrollButton,
  Stage: ChatShellStage,
  Viewport: ChatShellViewport,
});
