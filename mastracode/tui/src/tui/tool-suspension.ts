import type { InteractiveToolSuspensionKind } from '@mastra/core/tools';
import { INTERACTIVE_TOOL_SUSPENSION_KINDS } from '@mastra/core/tools';

export function classifyToolSuspension(payload: unknown, toolName?: string): InteractiveToolSuspensionKind | undefined {
  const kind = payload !== null && typeof payload === 'object' && 'kind' in payload ? payload.kind : undefined;
  switch (kind) {
    case INTERACTIVE_TOOL_SUSPENSION_KINDS.askUser:
    case INTERACTIVE_TOOL_SUSPENSION_KINDS.submitPlan:
    case INTERACTIVE_TOOL_SUSPENSION_KINDS.requestAccess:
      return kind;
  }
  if (kind !== undefined) return undefined;

  // Parked runs survive restart, and a remote Factory may still emit pre-kind
  // payloads. Remove this fallback once supported stored runs and remote producers
  // are migrated to discriminated payloads. Never override an explicit unknown kind.
  switch (toolName) {
    case 'ask_user':
      return INTERACTIVE_TOOL_SUSPENSION_KINDS.askUser;
    case 'submit_plan':
      return INTERACTIVE_TOOL_SUSPENSION_KINDS.submitPlan;
    case 'request_access':
      return INTERACTIVE_TOOL_SUSPENSION_KINDS.requestAccess;
    default:
      return undefined;
  }
}
