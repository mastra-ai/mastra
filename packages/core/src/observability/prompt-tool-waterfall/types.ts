export type PromptToolWaterfallPhaseKind =
  | 'initial'
  | 'memory_added'
  | 'input_processors'
  | 'prepare_step'
  | 'pre_model'
  | 'structured_output';

export type PromptRole = 'system' | 'user' | 'assistant' | 'tool' | 'other';

export type PromptSummary = {
  messageCount: number;
  totalChars: number;
  charsByRole: Record<PromptRole, number>;
  partsByRole: Record<PromptRole, number>;
};

export type ToolSummary = {
  id: string;
  name: string;
  inputSchemaChars: number;
  outputSchemaChars: number;
};

export type ToolSurfaceSummary = {
  toolCount: number;
  toolChoice?: string | { type: string; toolName?: string };
  activeTools?: string[];
  tools: ToolSummary[];
};

export type PromptToolWaterfallDelta = {
  promptCharsDelta: number;
  promptCharsByRoleDelta: Partial<Record<PromptRole, number>>;
  messageCountDelta: number;
  toolsAdded: string[];
  toolsRemoved: string[];
  toolCountDelta: number;
  activeToolsAdded: string[];
  activeToolsRemoved: string[];
  toolChoiceChanged: boolean;
  structuredOutput?: {
    mode: 'direct' | 'processor' | 'native';
    mutated: boolean;
  };
};

export type PromptToolWaterfallPhase = {
  kind: PromptToolWaterfallPhaseKind;
  stepIndex: number;
  prompt: PromptSummary;
  toolSurface: ToolSurfaceSummary;
  delta: PromptToolWaterfallDelta;
  meta?: Record<string, string | number | boolean>;
};

export type PromptToolWaterfallStatus = 'finished' | 'tripwire' | 'error' | 'suspended';

export type PromptToolWaterfall = {
  runId: string;
  status: PromptToolWaterfallStatus;
  stepCount: number;
  phases: PromptToolWaterfallPhase[];
  finalPrompt?: PromptSummary;
  finalToolSurface?: ToolSurfaceSummary;
  tripwire?: {
    reasonChars: number;
    processorId?: string;
  };
  error?: {
    name?: string;
    messageChars: number;
  };
};

export type PromptToolWaterfallAttributes = {
  waterfall: PromptToolWaterfall;
};
