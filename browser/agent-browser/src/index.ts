// Main exports
export { AgentBrowser } from './agent-browser';

// Type exports
export type { BrowserConfig } from './types';
export type { AgentBrowserConfig } from './agent-browser';
export type { CreateAgentBrowserThreadManager } from './thread-manager';

// Thread manager (for custom providers e.g. @mastra/browser-firecrawl)
export { AgentBrowserThreadManager } from './thread-manager';
export type { AgentBrowserThreadManagerConfig, AgentBrowserSession } from './thread-manager';

// Utility exports
export { getBrowserPid } from './utils';

// Tool exports
export { createAgentBrowserTools, BROWSER_TOOLS } from './tools';
export type { BrowserToolName } from './tools';

// Schema exports
export {
  // Core
  gotoInputSchema,
  snapshotInputSchema,
  clickInputSchema,
  typeInputSchema,
  pressInputSchema,
  selectInputSchema,
  scrollInputSchema,
  closeInputSchema,
  // Extended
  hoverInputSchema,
  backInputSchema,
  dialogInputSchema,
  waitInputSchema,
  tabsInputSchema,
  dragInputSchema,
  // Escape hatch
  evaluateInputSchema,
  // All schemas
  browserSchemas,
} from './schemas';

export type {
  GotoInput,
  SnapshotInput,
  ClickInput,
  TypeInput,
  PressInput,
  SelectInput,
  ScrollInput,
  CloseInput,
  HoverInput,
  BackInput,
  DialogInput,
  WaitInput,
  TabsInput,
  DragInput,
  EvaluateInput,
} from './schemas';
