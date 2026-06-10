// ---------------------------------------------------------------------------
// Permission policy + tool category types (v1).
//
// These mirror the legacy harness shapes so the v1 tool composer can consume
// the same policy surface. Defined here (re-exported) instead of imported
// directly so the v1 module does not pull in legacy harness internals.
// ---------------------------------------------------------------------------

export type PermissionPolicy = 'allow' | 'ask' | 'deny';
export type ToolCategory = 'read' | 'edit' | 'execute' | 'mcp' | 'other' | (string & {});

export type ToolCategoryResolver = (toolName: string) => ToolCategory | null;

export interface PermissionRule {
  policy: PermissionPolicy;
}

export interface PermissionRules {
  /** Per-tool override map. */
  tools?: Record<string, PermissionPolicy | PermissionRule>;
  /** Per-category override map. */
  categories?: Record<string, PermissionPolicy | PermissionRule>;
  /** Rule-level default used before Harness defaultPermissionPolicy. */
  defaultPolicy?: PermissionPolicy;
}

export interface SessionGrant {
  id?: string;
  toolName?: string;
  category?: ToolCategory;
  expiresAt?: number | string | Date | null;
}

export type PermissionDecision = 'allow' | 'deny' | 'pendingApproval';
export type PermissionReason = 'tool-config' | 'tool-fn' | 'policy';
export type PermissionGate = 'pre-exposure' | 'pre-action';

export interface PermissionCheckInput {
  toolName: string;
  category?: ToolCategory | null;
  args?: unknown;
  gate: PermissionGate;
  permissionRules?: PermissionRules;
  sessionGrants?: readonly SessionGrant[];
  defaultPermissionPolicy?: PermissionPolicy;
  yolo?: boolean;
  toolConfigRequiresApproval?: boolean;
  toolFnRequiresApproval?: boolean;
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
  category: ToolCategory | null;
  result: PermissionCheckResult;
}

export type PermissionRequestedCallback = (event: PermissionRequestedEvent) => void | Promise<void>;
