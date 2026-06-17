// ---------------------------------------------------------------------------
// Session permission policy + tool category types.
//
// These mirror the legacy harness shapes so the session tool composer can consume
// the same policy surface. Defined here (re-exported) instead of imported
// directly so the session module does not pull in legacy harness internals.
// ---------------------------------------------------------------------------

export type PermissionPolicy = 'allow' | 'ask' | 'deny';
export type ToolCategory = 'read' | 'edit' | 'execute' | 'mcp' | 'other' | (string & {});

export type ToolCategoryResolver = (toolName: string) => ToolCategory | null;

export type PermissionArgPatterns = Record<string, string>;

export type PermissionRule =
  | {
      policy: PermissionPolicy;
      toolName: string;
      category?: never;
      args?: PermissionArgPatterns;
    }
  | {
      policy: PermissionPolicy;
      category: ToolCategory;
      toolName?: never;
      args?: never;
    };

export interface PermissionGrant {
  id?: string;
  toolName?: string;
  category?: ToolCategory;
  args?: PermissionArgPatterns;
  expiresAt?: number | string | Date | null;
}

export type PermissionDecision = 'allow' | 'deny' | 'pendingApproval';
export type PermissionReason = 'tool-config' | 'policy';
export type PermissionGate = 'pre-exposure' | 'pre-action';

export interface PermissionCheckInput {
  toolName: string;
  category?: ToolCategory | null;
  args?: unknown;
  gate: PermissionGate;
  permissionRules?: readonly PermissionRule[];
  sessionGrants?: readonly PermissionGrant[];
  defaultPermissionPolicy?: PermissionPolicy;
  yolo?: boolean;
  toolConfigRequiresApproval?: boolean;
}

export interface PermissionCheckResult {
  decision: PermissionDecision;
  policy: PermissionPolicy;
  reasons: PermissionReason[];
  metadata: {
    toolName: string;
    category: ToolCategory | null;
    gate: PermissionGate;
    matchedRule: 'tool' | 'category' | 'default' | 'fallback';
    grantId?: string;
    yolo?: boolean;
  };
}

export interface PermissionRequestedEvent {
  pendingItemId: string;
  toolName: string;
  toolCallId?: string;
  category: ToolCategory | null;
  args?: unknown;
  result: PermissionCheckResult;
}

export type PermissionRequestedCallback = (event: PermissionRequestedEvent) => void | Promise<void>;
