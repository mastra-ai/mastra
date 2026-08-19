export const PI_COMPATIBILITY_TARGET_VERSION = '0.84.2' as const;

export type PiCapabilitySupport = 'direct' | 'adapted' | 'version-gated' | 'unsupported';

export type PiPackageCompatibilityStatus = 'pi-compatible' | 'pi-partial' | 'pi-incompatible';

export interface PiCompatibilityEvidence {
  source: string;
  detail?: string;
}

export interface PiCompatibilityDiagnostic {
  severity: 'info' | 'warning' | 'error';
  message: string;
  capability?: string;
  extensionId?: string;
}

export interface PiCapabilityCompatibility {
  name: string;
  support: PiCapabilitySupport;
  evidence: PiCompatibilityEvidence[];
  diagnostics: PiCompatibilityDiagnostic[];
}

export interface PiPackageCompatibility {
  targetApiVersion: typeof PI_COMPATIBILITY_TARGET_VERSION;
  status: PiPackageCompatibilityStatus;
  capabilities: PiCapabilityCompatibility[];
  diagnostics: PiCompatibilityDiagnostic[];
}

const PI_CAPABILITY_SUPPORT: Readonly<Record<string, PiCapabilitySupport>> = {
  registerTool: 'adapted',
  registerCommand: 'adapted',
  registerShortcut: 'version-gated',
  registerFlag: 'adapted',
  getFlag: 'adapted',
  registerMessageRenderer: 'adapted',
  registerMarkdownTransformer: 'unsupported',
  registerEntryRenderer: 'unsupported',
  registerProvider: 'adapted',
  registerNativeProvider: 'unsupported',
  unregisterProvider: 'adapted',
  events: 'direct',
  sendMessage: 'adapted',
  sendUserMessage: 'adapted',
  appendEntry: 'adapted',
  setSessionName: 'adapted',
  getSessionName: 'adapted',
  setLabel: 'adapted',
  exec: 'adapted',
  getActiveTools: 'adapted',
  getAllTools: 'adapted',
  setActiveTools: 'adapted',
  getCommands: 'direct',
  setModel: 'adapted',
  getThinkingLevel: 'adapted',
  setThinkingLevel: 'adapted',
};

const PI_EVENT_SUPPORT: Readonly<Record<string, PiCapabilitySupport>> = {
  project_trust: 'adapted',
  resources_discover: 'adapted',
  session_start: 'adapted',
  session_info_changed: 'adapted',
  session_before_switch: 'adapted',
  session_before_fork: 'adapted',
  session_before_compact: 'adapted',
  session_compact: 'adapted',
  session_compact_failed: 'adapted',
  session_shutdown: 'adapted',
  session_before_tree: 'unsupported',
  session_tree: 'unsupported',
  context: 'adapted',
  before_provider_request: 'adapted',
  before_provider_headers: 'unsupported',
  after_provider_response: 'adapted',
  before_agent_start: 'adapted',
  agent_start: 'adapted',
  agent_end: 'adapted',
  agent_settled: 'adapted',
  turn_start: 'adapted',
  turn_end: 'adapted',
  message_start: 'adapted',
  message_update: 'adapted',
  message_end: 'adapted',
  tool_execution_start: 'direct',
  tool_execution_update: 'direct',
  tool_execution_end: 'direct',
  model_select: 'adapted',
  thinking_level_select: 'adapted',
  tool_call: 'adapted',
  tool_result: 'adapted',
  user_bash: 'adapted',
  input: 'adapted',
};

export function getPiCapabilitySupport(capability: string): PiCapabilitySupport {
  if (capability.startsWith('event:')) {
    return PI_EVENT_SUPPORT[capability.slice('event:'.length)] ?? 'unsupported';
  }
  return PI_CAPABILITY_SUPPORT[capability] ?? 'unsupported';
}

export function getPiPackageCompatibilityStatus(
  capabilities: readonly PiCapabilityCompatibility[],
): PiPackageCompatibilityStatus {
  const supportedCount = capabilities.filter(
    capability => capability.support === 'direct' || capability.support === 'adapted',
  ).length;
  const gatedCount = capabilities.filter(capability => capability.support === 'version-gated').length;
  const unsupportedCount = capabilities.filter(capability => capability.support === 'unsupported').length;

  if (supportedCount === 0) {
    return 'pi-incompatible';
  }
  if (gatedCount > 0 || unsupportedCount > 0) {
    return 'pi-partial';
  }
  return 'pi-compatible';
}

export function createPiPackageCompatibility(
  capabilities: PiCapabilityCompatibility[],
  diagnostics: PiCompatibilityDiagnostic[] = [],
): PiPackageCompatibility {
  return {
    targetApiVersion: PI_COMPATIBILITY_TARGET_VERSION,
    status: getPiPackageCompatibilityStatus(capabilities),
    capabilities,
    diagnostics,
  };
}
