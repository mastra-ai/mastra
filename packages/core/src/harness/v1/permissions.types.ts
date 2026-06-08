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
