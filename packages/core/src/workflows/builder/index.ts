import type { Predicate } from '../predicate';
import type { ValidatableStepFlowEntry, WorkflowValidationInput } from '../stored/validate/types';
import type { SerializedSingleStepEntry, SerializedStepOptions } from '../types';

export type WorkflowBuilderJsonValue =
  | string
  | number
  | boolean
  | null
  | WorkflowBuilderJsonValue[]
  | { [key: string]: WorkflowBuilderJsonValue };

export type WorkflowBuilderJsonObject = { [key: string]: WorkflowBuilderJsonValue };

export type WorkflowBuilderStepOptions = SerializedStepOptions;

/**
 * Authoring leaf entries are the canonical serialized leaf union minus
 * code-only `step` descriptors (a persisted definition cannot reference a
 * live Step object). Derived, not duplicated: when the serialized union
 * changes, these change with it.
 */
export type WorkflowBuilderSingleStepEntry = Exclude<SerializedSingleStepEntry, { type: 'step' }>;

export type WorkflowBuilderAgentEntry = Extract<WorkflowBuilderSingleStepEntry, { type: 'agent' }>;
export type WorkflowBuilderToolEntry = Extract<WorkflowBuilderSingleStepEntry, { type: 'tool' }>;
export type WorkflowBuilderMappingEntry = Extract<WorkflowBuilderSingleStepEntry, { type: 'mapping' }>;
export type WorkflowBuilderWorkflowEntry = Extract<WorkflowBuilderSingleStepEntry, { type: 'workflow' }>;

export type WorkflowBuilderExecutableInnerEntry = Exclude<WorkflowBuilderSingleStepEntry, { type: 'mapping' }>;

/**
 * Container entries are hand-written *narrowings* of the serialized union:
 * declarative predicates are required (closure conditions can't be authored),
 * fluent-only debug labels (`serializedConditions`/`serializedCondition`) are
 * absent, and `sleepUntil.date` is the wire's ISO string rather than a Date.
 * The static assertions at the bottom of this file prove each narrowing stays
 * inside the canonical union — drift is a compile error.
 */
export interface WorkflowBuilderParallelEntry {
  type: 'parallel';
  steps: WorkflowBuilderExecutableInnerEntry[];
}

export interface WorkflowBuilderForeachEntry {
  type: 'foreach';
  step: WorkflowBuilderExecutableInnerEntry;
  opts?: { concurrency: number };
}

export interface WorkflowBuilderSleepEntry {
  type: 'sleep';
  id: string;
  duration: number;
}

export interface WorkflowBuilderSleepUntilEntry {
  type: 'sleepUntil';
  id: string;
  date: string;
}

export interface WorkflowBuilderConditionalEntry {
  type: 'conditional';
  steps: WorkflowBuilderExecutableInnerEntry[];
  predicates: Predicate[];
}

export interface WorkflowBuilderLoopEntry {
  type: 'loop';
  step: WorkflowBuilderExecutableInnerEntry;
  loopType: 'dowhile' | 'dountil';
  predicate: Predicate;
}

export type WorkflowBuilderGraphEntry =
  | WorkflowBuilderSingleStepEntry
  | WorkflowBuilderParallelEntry
  | WorkflowBuilderForeachEntry
  | WorkflowBuilderSleepEntry
  | WorkflowBuilderSleepUntilEntry
  | WorkflowBuilderConditionalEntry
  | WorkflowBuilderLoopEntry;

export interface WorkflowBuilderDefinition {
  id: string;
  description?: string;
  inputSchema: WorkflowBuilderJsonObject;
  outputSchema: WorkflowBuilderJsonObject;
  stateSchema?: WorkflowBuilderJsonObject;
  requestContextSchema?: WorkflowBuilderJsonObject;
  graph: WorkflowBuilderGraphEntry[];
}

type Extends<A, B> = [A] extends [B] ? true : false;
type Expect<T extends true> = T;

/**
 * Compile-time drift guards: the authoring universe must remain a subset of
 * the canonical serialized/wire union the validation core operates on. If a
 * serialized variant gains a required field (or an authoring type drifts),
 * these tuple members stop typechecking and the build fails.
 */
export type WorkflowBuilderTypeAssertions = [
  Expect<Extends<WorkflowBuilderGraphEntry, ValidatableStepFlowEntry>>,
  Expect<Extends<WorkflowBuilderDefinition, WorkflowValidationInput>>,
];

export const WORKFLOW_BUILDER_SUPPORTED_STEP_TYPES = [
  'agent',
  'tool',
  'mapping',
  'workflow',
  'parallel',
  'foreach',
  'sleep',
  'sleepUntil',
  'conditional',
  'loop',
] as const;

export type WorkflowBuilderSupportedStepType = (typeof WORKFLOW_BUILDER_SUPPORTED_STEP_TYPES)[number];

export const WORKFLOW_BUILDER_AUTHORING_CONSTRAINTS = `# Persisted workflow authoring contract

A persisted workflow is a JSON-safe static graph. The supported entry types are agent, tool, mapping, nested workflow, parallel, foreach, sleep, sleepUntil, declarative conditional, and declarative loop. Closure mappings, function predicates, callbacks, and arbitrary executable functions are unsupported.

Every adjacent step must compose exactly: the previous output shape must satisfy the next input schema. Agent inputs are always { prompt: string }. Insert a mapping step whenever shapes differ; never rely on implicit coercion. A mapping's output keys are the top-level keys of its JSON-encoded mapConfig. Persisted mappings only select, rename, template, or provide constant values; they cannot evaluate arithmetic or arbitrary expressions. Template placeholders must use inputData, initData, state, requestContext, or stepResults namespaces (for example \${stepResults.add-numbers.result}), never input, steps, or JavaScript expressions. Use a discovered tool or agent when computation is required.

Mapping entries must be top-level linear steps. Parallel and conditional children, foreach bodies, and loop bodies may be agent, tool, or nested workflow entries; do not place mappings or nested containers inside them. Parallel and conditional children all receive the same preceding output. Foreach requires an array input and passes each array item directly to its body. Loop bodies must accept both the preceding output and their own output on later iterations. Use a nested workflow when a branch or foreach item needs its own input-shaping mapping. Conditional predicates align by index with their branch steps. Loop and conditional predicates must use the declarative predicate DSL.

Nested workflow entries must use the referenced workflowId as their step id because persisted runtime rehydration cannot preserve a separate call-site identity. Use dependency IDs returned by discovery. Never invent agent, tool, or workflow IDs. Keep workflow IDs, step IDs, schemas, mapping configs, options, predicates, and metadata JSON-safe.`;

export const WORKFLOW_BUILDER_AUTHORING_PLAYBOOK = `${WORKFLOW_BUILDER_AUTHORING_CONSTRAINTS}

# How a workflow runs

A workflow takes one **input object** (matching \`inputSchema\`) and runs an ordered list of **steps**. Each step receives the previous step's **output object** as its input and produces its own output object. The workflow's final output is the last step's output, which must match \`outputSchema\`.

There are ten step types. The COLUMNS in the table below are the contract you must respect.

| Step type     | Input it receives | Output it produces |
|---------------|-------------------|--------------------|
| \`tool\`        | Previous step's output, validated against the tool's \`inputSchema\`. | The exact shape of the tool's \`outputSchema\`. |
| \`agent\`       | STRICTLY \`{ prompt: string }\`. The engine does NOT coerce; it validates and throws "expected object, received …" if the previous step's output isn't exactly this shape. If your previous step doesn't already produce \`{ prompt: string }\`, you MUST insert a \`mapping\` step in between. | Default: \`{ text: string }\`. If the entry sets \`outputSchema\` (see "Structured agent output" below), the output IS that schema's shape. |
| \`workflow\`    | Previous step's output, validated against the referenced workflow's \`inputSchema\`. The nested workflow is identified by \`workflowId\` (id of another workflow registered on the Mastra instance — either code-defined via \`createWorkflow\` or stored via \`save-workflow\`). | The referenced workflow's \`outputSchema\`. |
| \`mapping\`     | Nothing directly — mappings *project* from any prior step's results, the workflow input, etc. (See "Mappings" below.) | An object whose top-level keys are the keys of \`mapConfig\`. |
| \`parallel\`    | Previous step's output, forwarded to EVERY child step. Children must be single-step-like (\`agent\` / \`tool\` / \`workflow\` / \`mapping\`) — no nested \`parallel\` / \`foreach\` / \`sleep\`. | An object keyed by each child step's \`id\`, whose value is that child's output. |
| \`foreach\`     | An **array**. The previous step MUST output an array. The inner step runs once per element (with concurrency you choose). | An array of the inner step's outputs, one per input element, order-preserving. |
| \`sleep\`       | Passes the previous step's output through unchanged after waiting \`duration\` ms. | Same as its input. Use to space out steps deterministically. |
| \`sleepUntil\`  | Passes the previous step's output through unchanged after waiting until an ISO date. | Same as its input. Use for "run at a specific wall-clock time". |
| \`conditional\` | Previous step's output, forwarded to EVERY branch step. Each branch fires only if its declarative \`predicate\` evaluates truthy. | An object keyed by each branch step's \`id\`, whose value is that branch's output (or \`undefined\` for branches whose predicate was false). |
| \`loop\`        | Previous step's output on iteration 1; the inner step's own previous output on subsequent iterations. \`dowhile\` re-runs while the predicate is TRUE; \`dountil\` re-runs until the predicate is TRUE. | The inner step's LAST-iteration output. |

# The composition rule — schemas MUST match

This is the single most important rule in this document. Every step declares an \`inputSchema\` (what it consumes) and an \`outputSchema\` (what it produces). Two adjacent steps compose ONLY IF the previous step's output shape structurally satisfies the next step's input shape. When they don't match, the engine throws a validation error at runtime and the workflow fails.

**When shapes don't line up, the fix is ALWAYS to insert a \`mapping\` step between them.** There is no other mechanism. Do not hope the engine will "figure it out" — it will not.

For every adjacent pair of steps you plan, run this check:

- If the NEXT step is an **agent** → its required input is HARD-CODED to \`{ prompt: string }\`. Nothing else. If the previous step doesn't produce that exact shape, insert a mapping whose \`mapConfig\` has a single key \`prompt\`.
- If the NEXT step is a **tool** → its required input is the tool's \`inputSchema\` from \`list-available-tools\`. If the previous step's output doesn't match every required field, insert a mapping producing exactly that shape.
- If the NEXT step is a **workflow** → its required input is the referenced workflow's \`inputSchema\` (from \`list-available-workflows\`). If the previous step's output doesn't match, insert a mapping. The nested workflow runs to completion and its final output becomes the next step's input.
- If the NEXT step is a **mapping** → no check. Mappings can pull from any prior step by id.
- If the NEXT step is a **foreach** → the previous step's output MUST be a raw array \`Array<T>\`, where \`T\` structurally matches the foreach's INNER step's input. Recurse the check: inner is agent → \`T\` must be \`{ prompt: string }\`; inner is tool → \`T\` must be that tool's \`inputSchema\`; inner is workflow → \`T\` must be the referenced workflow's \`inputSchema\`.
- If the NEXT step is a **parallel** → its children each receive the previous step's output. Each child runs the check independently for its own input shape.
- If the NEXT step is **sleep** or **sleepUntil** → pass-through; the check applies to the step AFTER it.
- If the NEXT step is a **conditional** → each branch step receives the previous step's output; recurse the check independently per branch step. The predicates themselves only read paths — they do not consume input.
- If the NEXT step is a **loop** → the inner step receives the previous step's output on iteration 1 and its own previous output thereafter, so the inner step's \`inputSchema\` MUST also be satisfied by its own \`outputSchema\` (input/output shapes must match, or the second iteration will fail validation).

## Schema shapes you MUST have memorised

- **Tool step.** Input and output are exactly what \`list-available-tools\` reports. No wrapping. No coercion. If the tool's \`outputSchema\` is a string, the next step receives a string. Period.
- **Agent step.** Input is ALWAYS \`{ prompt: string }\` — this is fixed by the engine, not something you can change on the entry. Output is \`{ text: string }\` unless the entry declares \`outputSchema\`, in which case the output IS that declared shape.
- **Mapping step.** Output is an object whose top-level keys are the keys of \`mapConfig\`. Input is unconstrained (mappings source from anywhere by id).

## The single most common miswire

Tool that returns a string → agent step. The tool emits \`"…text…"\`; the agent expects \`{ prompt: string }\`. The engine throws \`Step input validation failed: Invalid input: expected object, received string\`. The fix is a mapping between them:

\`\`\`json
[
  { "type": "tool", "id": "list", "toolId": "mastra_workspace_list_files" },
  {
    "type": "mapping",
    "id": "to-prompt",
    "mapConfig": "{\\"prompt\\":{\\"template\\":\\"Extract every .ts path from the listing below.\\\\n\\\\n\${stepResults.list}\\"}}"
  },
  { "type": "agent", "id": "extract", "agentId": "code-agent" }
]
\`\`\`

Read the tool's actual \`outputSchema\` first. If it's a primitive (\`z.string()\`, \`z.number()\`, \`z.boolean()\`), reference the whole result: \`\${stepResults.<id>}\`. If it's an object or array, you can either pluck a specific field (\`\${stepResults.<id>.<field>}\`) OR reference the whole thing bare (\`\${stepResults.<id>}\`) and let the template JSON-encode it for the agent. Never guess field names.

# Mappings — how to reshape data between steps

A mapping step's \`mapConfig\` is a **JSON-encoded string** of an object (yes, encoded — \`mapConfig\` is a string, not an object). Each top-level key becomes a field of the mapping's output. Each value is one of these source forms:

- \`{ "template": "<text with \${placeholders}>" }\` — interpolates a string. Placeholders can read from these namespaces:
  - \`\${inputData.<field>}\` — a field of the CURRENT step's live input, which equals the PREVIOUS step's output. For step 1 only, this happens to equal the workflow input (because step 1's input IS the workflow input). From step 2 onward, \`inputData\` is the previous step's output — if you want the workflow's original input past step 1, use \`\${initData.<field>}\` instead.
  - \`\${initData.<field>}\` — a field of the WORKFLOW's original input, available from ANY step. Use this whenever a mid-workflow step needs an argument from the top-level workflow input (e.g. a step-3 mapping referencing \`\${initData.path}\`).
  - \`\${stepResults.<stepId>.<field>}\` — a field of an earlier step's output when the output is an object. Dotted paths drill into nested fields.
  - \`\${stepResults.<stepId>}\` — the whole step result. Primitives render as \`String(v)\`; objects and arrays are JSON-encoded (via \`JSON.stringify\`) so downstream agents get the full structure inline. Use this bare form when you want an agent to see the entire upstream shape (e.g. feeding \`foreach(agent)\`'s \`{ text }[]\` output into a synthesis step).
  - \`\${state.<field>}\`, \`\${requestContext.<field>}\` — advanced, rarely needed.
  Templates render primitives as strings and JSON-encode objects/arrays. \`null\`/\`undefined\` render as \`""\`. Pluck a field only when you specifically want just that field; bare references are fine (and preferred) when the agent should see the whole structure.
- \`{ "value": <constant> }\` — embed a literal JSON value.
- \`{ "initData": true, "path": "<field.path>" }\` — pluck a field from the workflow's original input. This is the canonical direct source form; do not emit \`{ "initData": "<field>" }\`, \`{ "initData": true }\` without \`path\`, or combine it with \`step\`.
- \`{ "step": "<stepId>", "path": "<field.path>" }\` — pluck a single field from a prior step's output. Dotted paths drill into nested objects. This source must not also include \`initData\`.

Canonical direct-source examples:

\`\`\`json
{
  "mapConfig": "{\\"name\\":{\\"initData\\":true,\\"path\\":\\"name\\"},\\"customerId\\":{\\"step\\":\\"lookup-customer\\",\\"path\\":\\"customerId\\"},\\"status\\":{\\"value\\":\\"open\\"},\\"summary\\":{\\"template\\":\\"Ticket for \${initData.name}: \${stepResults.lookup-customer.customerId}\\"}}"
}
\`\`\`

Every direct path mapping references **exactly one** source: either \`initData: true\` plus \`path\`, or \`step\` plus \`path\`. Constants use only \`value\`; interpolated strings use only \`template\`.

# Structured agent output — how to make an agent step return more than \`{ text }\`

By default, every agent step's output is \`{ text: string }\`. That's fine when the agent's job is to write prose. It is NOT fine when a downstream step needs a machine-readable value — most importantly, when the next step is a \`foreach\` (which requires an array).

To make an agent step produce a structured shape, set \`outputSchema\` on the entry. It's a JSON Schema (Draft 2020-12) that the engine enforces at runtime and that also becomes the step's declared output shape for downstream wiring.

\`\`\`json
{
  "type": "agent",
  "id": "extract-paths",
  "agentId": "code-agent",
  "outputSchema": {
    "type": "array",
    "items": { "type": "string" },
    "description": "Absolute or repo-relative file paths, one per string."
  }
}
\`\`\`

Rules:
- \`outputSchema\` must be plain JSON Schema — same Draft 2020-12 subset the workflow's top-level \`inputSchema\` / \`outputSchema\` use. Nested objects, arrays, enums, and \`required\` all round-trip.
- When set, the step's output IS the schema's shape. So the agent above produces \`string[]\` — a raw array — which means a \`foreach\` can iterate it directly.
- The agent's prompt still comes from the previous step's output (coerced to a user message). \`outputSchema\` shapes only what the agent RETURNS, not what it receives.
- Only agent entries support \`outputSchema\`. Tool entries derive their output shape from the tool's registered \`outputSchema\` — you don't set it on the step.
- Both agent and tool entries also accept an optional \`options: { retries?, metadata? }\` bag. Skip it unless the user asks for retries.

Use structured output when: the downstream step needs an array (for \`foreach\`), a specific object (for a mapping's \`step:\` source), or any value beyond free-form prose.

# Fan-out, iteration, and waiting — the container step types

These four types are top-level entries in \`graph\`. They can NOT nest inside each other in v1: a \`parallel\`'s children are \`agent\` / \`tool\` / \`mapping\` only, and \`foreach\`'s inner step is a single step, not another container.

**\`parallel\` — run several branches on the same input.** Emit exactly this shape:

\`\`\`json
{
  "type": "parallel",
  "steps": [
    { "type": "agent", "id": "summarise", "agentId": "code-agent" },
    { "type": "tool",  "id": "count-lines", "toolId": "wc-lines-tool" }
  ]
}
\`\`\`

The parallel step's output is \`{ "summarise": { "text": "..." }, "count-lines": <its outputSchema> }\`. It contains the complete output of **every** child under that child's id; never replace child outputs with only the input values used to call them. Downstream steps that need one branch's result pluck it via \`stepResults.<parallelId>.<childId>.<field>\` in a mapping.

**\`foreach\` — run the same step over every item in an array.** THIS IS THE ONLY WAY to run a step per-item. If the user says "for each", "for every", "on each", "one per", "iterate over", "run X on all the Ys", "map over" — the answer is \`foreach\`. Do not try to fake it with an agent that "loops internally"; do not try to unroll the array into N sibling steps. Emit:

\`\`\`json
{
  "type": "foreach",
  "step": { "type": "agent", "id": "review-file", "agentId": "code-agent" },
  "opts": { "concurrency": 3 }
}
\`\`\`

The rules:
- The step IMMEDIATELY BEFORE a \`foreach\` MUST produce an ARRAY as its top-level output. Not an object with an array field — the array itself. Foreach iterates \`previous.output\`, not \`previous.output.<somekey>\`.
- Because a \`mapping\` step always outputs an OBJECT (its top-level keys are \`mapConfig\`'s keys), a mapping CANNOT be the step before a \`foreach\` — a mapping's output is never a raw array.
- The inner \`step\` is a SINGLE step-like entry: \`{ "type": "agent", ... }\` or \`{ "type": "tool", ... }\`. No nested \`foreach\` / \`parallel\` / \`mapping\`.
- The inner step's \`id\` MUST be distinct from every other step id in the workflow (including the surrounding steps). A duplicate id will collide with \`stepResults\` lookups.
- The inner step receives ONE ELEMENT of the array at a time as its input. If the element is a string and the inner step is an agent, the agent gets that string coerced to the user message. If the element is an object, the agent gets the JSON of that object.
- Output is an array of the inner step's outputs, order-preserved. Agent inner steps ⇒ \`{ text: string }[]\`. Tool inner steps ⇒ \`toolOutputSchema[]\`.
- \`opts.concurrency\` (optional, default 1) controls how many elements run at once.

**When the upstream step does NOT produce a raw array — INSERT A BRIDGE AGENT.** This is the critical case, and it is what you will hit most often. Tools like \`find_files\` return a formatted \`string\`; other tools return objects. You must NOT give up on \`foreach\` in this case, and you must NOT fake iteration inside a single agent's prompt. Instead, insert an \`agent\` step BETWEEN the upstream step and the \`foreach\` whose sole job is to convert the upstream data into the array shape \`foreach\` needs. That bridge agent MUST declare an \`outputSchema\` whose top-level shape is the array (\`z.array(...)\` — in the save-workflow schema this is expressed as \`{ type: "array", items: {...} }\`). Because you can override an agent step's output shape via \`outputSchema\`, this bridge is always available, no matter what the upstream tool returns.

Concretely, the shape is ALWAYS one of:

- \`tool (returns array) → foreach\` — direct, no bridge.
- \`agent-with-outputSchema-array → foreach\` — direct, the agent step itself is the array producer.
- \`tool (returns string OR object) → bridge-agent (outputSchema: array) → foreach\` — the common case, USE THIS.
- \`upstream-step → mapping (to build { prompt }) → bridge-agent (outputSchema: array) → foreach\` — when the bridge agent needs a specifically-shaped prompt and the upstream isn't already a plain string.

If the array elements must be strings and the inner \`foreach\` step is an \`agent\`, prefer \`outputSchema: z.array(z.object({ prompt: z.string() }))\` so each iteration receives a well-formed \`{ prompt }\` input.

Only fall back to a single \`code-agent\` that iterates internally if there is literally no way to produce an array — for example, if the upstream data is unbounded streaming or the user explicitly forbids an extra LLM turn. "The tool returns a string" is NOT a valid excuse — insert the bridge agent.

Worked example — \`foreach\` after a string-returning tool:

\`\`\`json
[
  { "type": "tool", "id": "list-files", "toolId": "find_files" },
  {
    "type": "agent",
    "id": "extract-paths",
    "agentId": "code-agent",
    "outputSchema": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": { "prompt": { "type": "string" } },
        "required": ["prompt"]
      },
      "description": "One { prompt } per file in the listing, where prompt asks the summarizer to read and summarize that file."
    }
  },
  {
    "type": "foreach",
    "step": { "type": "agent", "id": "summarise-one", "agentId": "code-agent" },
    "opts": { "concurrency": 3 }
  }
]
\`\`\`

The \`extract-paths\` bridge agent's prompt (which it receives as the upstream tool's string output, coerced to the user message) tells it to emit one \`{ prompt }\` object per file. Its \`outputSchema\` forces the array shape at the top level, which \`foreach\` then iterates over.

**\`sleep\` — wait a fixed number of milliseconds.** Static only; a function form exists in code but does NOT round-trip.

\`\`\`json
{ "type": "sleep", "id": "cool-off", "duration": 5000 }
\`\`\`

**\`sleepUntil\` — wait until an ISO wall-clock date.** Also static only.

\`\`\`json
{ "type": "sleepUntil", "id": "wait-for-noon", "date": "2026-07-14T12:00:00Z" }
\`\`\`

# Conditional branches and loops — declarative predicates

The engine supports \`conditional\` (branch-on-predicate) and \`loop\` (dowhile / dountil) as static, round-trippable step types PROVIDED the condition is expressed as a small declarative JSON predicate — NOT as JS code. Closure-based conditions cannot round-trip through storage; if the user asks for one, you must express it in the predicate DSL below or fall back to an agent step that decides internally.

**Predicate DSL — the exhaustive list of \`op\` shapes.** Every predicate is one of:

- Comparison: \`{ "op": "eq" | "ne" | "lt" | "lte" | "gt" | "gte", "left": <PathOrLiteral>, "right": <PathOrLiteral> }\`
- Membership: \`{ "op": "in" | "notIn", "value": <PathOrLiteral>, "set": [<scalar>, ...] }\`
- Existence: \`{ "op": "exists" | "notExists", "path": "<dot.path>" }\`
- Truthiness: \`{ "op": "truthy" | "falsy", "value": <PathOrLiteral> }\`
- Boolean: \`{ "op": "and" | "or", "args": [<predicate>, ...] }\` — one or more sub-predicates.
- Negation: \`{ "op": "not", "arg": <predicate> }\`

\`<PathOrLiteral>\` is EITHER \`{ "path": "<dot.path>" }\` (looks up a value in the runtime scope) OR \`{ "literal": <string|number|boolean|null> }\` (an inline scalar). \`<scalar>\` in \`set\` is a raw string / number / boolean / null.

**Path scope — what \`"path"\` reads.** Predicates are evaluated with the same runtime scope as mappings:

- \`initData.<field>\` — the workflow's original input.
- \`inputData.<field>\` — the CURRENT step's input, i.e. the previous step's output. Use this to read what the conditional/loop sees on this iteration.
- \`stepResults.<stepId>.<field>\` — any earlier step's output. Dotted paths drill into nested fields.
- \`state.<field>\`, \`requestContext.<field>\` — advanced.

**\`conditional\` — run branches whose predicate is true.** Emit exactly this shape:

\`\`\`json
{
  "type": "conditional",
  "steps": [
    { "type": "agent", "id": "fix-lint", "agentId": "code-agent" },
    { "type": "agent", "id": "celebrate", "agentId": "code-agent" }
  ],
  "predicates": [
    { "op": "gt", "left": { "path": "inputData.errorCount" }, "right": { "literal": 0 } },
    { "op": "eq", "left": { "path": "inputData.errorCount" }, "right": { "literal": 0 } }
  ]
}
\`\`\`

Rules:
- \`predicates\` MUST be the same length as \`steps\`, aligned by index — predicate \`i\` gates step \`i\`.
- Every branch that evaluates truthy runs (multiple branches CAN run in parallel — this is not a switch/case). If you need exactly-one, make the predicates mutually exclusive.
- Every branch step is a single step (\`agent\` / \`tool\` / \`mapping\`) — no nested containers.
- All branches receive the same input: the previous step's output.
- The output is an object keyed by each branch step's \`id\`; a branch whose predicate was false has an \`undefined\` entry.

**\`loop\` — repeat a step while / until a predicate holds.** Emit:

\`\`\`json
{
  "type": "loop",
  "step": { "type": "tool", "id": "poll-job", "toolId": "check_status_tool" },
  "loopType": "dountil",
  "predicate": { "op": "eq", "left": { "path": "inputData.status" }, "right": { "literal": "done" } }
}
\`\`\`

Rules:
- \`loopType: "dowhile"\` keeps looping while the predicate is TRUE.
- \`loopType: "dountil"\` keeps looping until the predicate is TRUE (predicate is the EXIT condition).
- The inner step runs at least once. Its \`outputSchema\` MUST also satisfy its own \`inputSchema\` (iteration N+1 feeds N's output back in), otherwise the second iteration fails validation.
- The predicate is evaluated on the inner step's output; use \`inputData.<field>\` to read that output inside the predicate.

# Nested workflows — compose one workflow inside another

You can reference an existing workflow as a single step. Discover valid ids with \`list-available-workflows\` and emit:

\`\`\`json
{ "type": "workflow", "id": "run-digest", "workflowId": "daily-standup-digest-only" }
\`\`\`

Rules:
- \`workflowId\` MUST match an id returned by \`list-available-workflows\`. Do not invent ids or reference workflows you plan to author later.
- The nested workflow's \`inputSchema\` is what the step CONSUMES; its \`outputSchema\` is what the step PRODUCES. Apply the composition check exactly as you would for a tool step.
- \`workflow\` entries are legal as branch steps inside \`conditional\`, as the inner step of \`foreach\` / \`dowhile\` / \`dountil\`, and as a child of \`parallel\`. Use this to keep the main graph flat: put a multi-step subgraph in its own stored workflow, then reference it.
- Do NOT self-reference (referencing the workflow you are currently authoring). Do NOT create cycles across workflows — the pre-flight validator will reject them.
- The nested workflow runs with its own scopes: its steps see their own \`initData\` (the input the parent passes into the nested workflow), its own \`stepResults\`, etc. The parent workflow only observes the nested workflow's final output.

# Authoring behavior — how to use your tools

- Always include a concise \`description\` on the workflow definition that summarizes what the workflow does. Do not persist a workflow with a null or empty description.
- Submit exactly ONE complete-definition call per attempt. Do NOT issue parallel or speculative \`submit-workflow-draft\` calls in the same turn — the second call will be superseded and will produce a misleading error even though your earlier submission was accepted.
- Batch resource discovery: use a single \`inspect-workflow-resources\` call with multiple \`ids\` rather than firing parallel inspections.
- Wait for the submission result before deciding what to do next. If it succeeds, stop and let the user click Save. Do not re-submit "just in case".
- If a submission returns \`reason: "superseded"\`, an earlier submission in this turn was accepted first. Do NOT apologize, retry, or tell the user the workflow is broken. The accepted revision is authoritative. Call \`inspect-workflow-resources\` to confirm the persisted state before making any claim about the workflow.
- If a redundant submission structurally matches the already-accepted revision, Studio treats it as a no-op success. That is confirmation the earlier submission is Ready; do NOT re-submit, do NOT tell the user something went wrong.
- Never describe persisted state (schemas, mapping form, graph shape, lifecycle) from memory. Inspect the workflow first, then describe what you actually saw.

# Out of scope — do NOT emit these

- Any \`sleep\` / \`sleepUntil\` with a function-form duration/date.
- \`conditional\` / \`loop\` with a JS-closure condition. Use the declarative predicate DSL above instead. If the condition genuinely cannot be expressed as a predicate (e.g. requires an LLM decision), fall back to an \`agent\` step that decides internally and returns \`{ text }\` naming the branch.
- Any \`mapping\` with an \`fn\` source. Only declarative sources (\`template\`, \`value\`, \`step\`, \`initData\`, \`requestContextPath\`) round-trip.`;

function normalizeJsonValue(value: unknown, path: string, seen: Set<object>): WorkflowBuilderJsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError(`${path} must contain only finite numbers.`);
    return value;
  }
  if (typeof value !== 'object') throw new TypeError(`${path} must be JSON-safe.`);
  if (seen.has(value)) throw new TypeError(`${path} must not contain cycles.`);
  seen.add(value);
  try {
    if (Array.isArray(value)) return value.map((item, index) => normalizeJsonValue(item, `${path}.${index}`, seen));
    if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) {
      throw new TypeError(`${path} must contain only plain objects.`);
    }
    const normalized: WorkflowBuilderJsonObject = {};
    for (const [key, item] of Object.entries(value)) {
      if (item !== undefined) normalized[key] = normalizeJsonValue(item, `${path}.${key}`, seen);
    }
    return normalized;
  } finally {
    seen.delete(value);
  }
}

function normalizeEntry(entry: Record<string, unknown>): WorkflowBuilderGraphEntry {
  const normalized = normalizeJsonValue(entry, 'graph entry', new Set()) as WorkflowBuilderJsonObject;
  if (normalized.type === 'agent' && typeof normalized.agentId !== 'string' && typeof normalized.agent === 'string') {
    normalized.agentId = normalized.agent;
    delete normalized.agent;
  }
  if (normalized.type === 'mapping' && typeof normalized.mapConfig !== 'string') {
    const mapConfig =
      normalized.mapConfig ?? (normalized.output === undefined ? undefined : { output: normalized.output });
    if (mapConfig !== undefined) normalized.mapConfig = JSON.stringify(mapConfig);
    delete normalized.output;
  }
  if ((normalized.type === 'parallel' || normalized.type === 'conditional') && Array.isArray(normalized.steps)) {
    normalized.steps = normalized.steps.map(step =>
      normalizeEntry(step as Record<string, unknown>),
    ) as unknown as WorkflowBuilderJsonValue[];
  }
  if ((normalized.type === 'foreach' || normalized.type === 'loop') && normalized.step) {
    normalized.step = normalizeEntry(normalized.step as Record<string, unknown>) as unknown as WorkflowBuilderJsonValue;
  }
  return normalized as unknown as WorkflowBuilderGraphEntry;
}

export function normalizeWorkflowBuilderDefinition(input: unknown): WorkflowBuilderDefinition {
  const normalized = normalizeJsonValue(input, 'workflow definition', new Set()) as WorkflowBuilderJsonObject;
  if (normalized.stateSchema === null) delete normalized.stateSchema;
  if (normalized.requestContextSchema === null) delete normalized.requestContextSchema;
  if (!Array.isArray(normalized.graph)) throw new TypeError('Workflow definition graph must be an array.');
  normalized.graph = normalized.graph.map(entry =>
    normalizeEntry(entry as Record<string, unknown>),
  ) as unknown as WorkflowBuilderJsonValue[];
  return normalized as unknown as WorkflowBuilderDefinition;
}

export * from './preflight';
export * from './inspection';
export * from './authoring-schema';
