export const WORKFLOW_BUILDER_AUTHORING_CONSTRAINTS = `# Persisted workflow authoring contract

A persisted workflow is a JSON-safe static graph. The supported entry types are agent, tool, mapping, parallel, foreach, sleep, and sleepUntil. Conditional and loop entries, closure mappings, and arbitrary executable functions are unsupported.

Every adjacent step must compose exactly: the previous output shape must satisfy the next input schema. Agent inputs are always { prompt: string }. Insert a mapping step whenever shapes differ; never rely on implicit coercion. A mapping's output keys are the top-level keys of its mapConfig.

Parallel children must be single-step agent, tool, or mapping entries; do not nest parallel, foreach, sleep, or sleepUntil entries inside parallel. Foreach input must be an array and its body may only be an agent or tool entry.

Use dependency IDs returned by discovery. Never invent agent or tool IDs. Keep workflow IDs, step IDs, schemas, mapping configs, options, and metadata JSON-safe.`;

export const WORKFLOW_BUILDER_SUPPORTED_STEP_TYPES = [
  'agent',
  'tool',
  'mapping',
  'parallel',
  'foreach',
  'sleep',
  'sleepUntil',
] as const;

export type WorkflowBuilderSupportedStepType = (typeof WORKFLOW_BUILDER_SUPPORTED_STEP_TYPES)[number];
