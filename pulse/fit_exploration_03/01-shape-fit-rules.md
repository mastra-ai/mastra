# Shape Fit Rules

This pass tests two export families.

## Reduced Family

```ts
type PulseExport =
  | Pulse
  | Change
  | Relationship
  | Snapshot;
```

`Snapshot` is optional in the reduced family. The sharper reduced set is:

```ts
type PulseExport =
  | Pulse
  | Change
  | Relationship;
```

### `Pulse`

A timestamped observation that something happened now.

```ts
type Pulse = {
  exportType: 'pulse';
  id: string;
  timestamp: string;
  flowId: string;
  pulseId: string;
  type: PulseType;
  surface: PulseSurface;
  action: PulseAction;
  level?: PulseLevel;
  text?: string;
  data?: Record<string, number>;
  attributes?: Record<string, unknown>;
  metadata?: Record<string, string>;
};
```

Rules:

- `type` is semantic: `input`, `output`, `decision`, `error`, `reasoning`, `state`, `progress`, `system`.
- `surface` is domain-oriented: `agent`, `model`, `tool`, `context`, `thread`, `harness`, `signal`, etc.
- `action` is constrained by `surface`.
- `primitive` is not required. If needed, put a stable primitive ref in `attributes` or derive it from a relationship.
- `data` contains numbers worth aggregating, graphing, comparing, or trending.
- `text` is optional and should be agent-readable first, human-readable second.
- No full `messages` arrays.

### `Change`

A durable or logical state changed.

```ts
type Change = {
  exportType: 'change';
  id: string;
  timestamp: string;
  surface: ChangeSurface;
  action: ChangeAction;
  subject: ExportRef;
  version?: number | string;
  previousVersion?: number | string;
  operations?: ChangeOperation[];
  attributes?: Record<string, unknown>;
  metadata?: Record<string, string>;
};
```

Rules:

- A `Change` can represent a definition creation/update, config edit, context truncation, message removal, state-signal snapshot/delta, task-list update, or thread setting update.
- There is no separate `Delta` shape. Deltas are `Change.operations`.
- Use operations when the important fact is how state changed, not just that it changed.
- Avoid full before/after payloads unless the payload is small or already a stable definition body.

Candidate operations:

```ts
type ChangeOperation =
  | { op: 'add'; path: string; valueRef?: ExportRef; value?: unknown }
  | { op: 'remove'; path: string; valueRef?: ExportRef }
  | { op: 'replace'; path: string; valueRef?: ExportRef; value?: unknown }
  | { op: 'move'; from: string; path: string }
  | { op: 'truncate'; path: string; removedRefs: ExportRef[]; retainedRefs?: ExportRef[] }
  | { op: 'compact'; fromRefs: ExportRef[]; toRef: ExportRef };
```

### `Relationship`

An append-only link between exports or external ids.

```ts
type Relationship = {
  exportType: 'relationship';
  id: string;
  timestamp: string;
  relationship: RelationshipType;
  from: ExportRef;
  to: ExportRef;
  metadata?: Record<string, string>;
};
```

Rules:

- Use for forward links that are awkward to know at original emission time.
- Good fits: `parent`, `next`, `previous_flow`, `flow_contains`, `uses_definition`, `thread_contains_flow`, `subagent_of`, `resume_of`, `supersedes`.
- Do not put payload data in relationships.

### `Snapshot`

A bounded reconstruction checkpoint.

```ts
type Snapshot = {
  exportType: 'snapshot';
  id: string;
  timestamp: string;
  subject: ExportRef;
  refs: ExportRef[];
  data?: Record<string, number>;
  metadata?: Record<string, string>;
};
```

Rules:

- Only keep `Snapshot` if it proves distinct from `Change`.
- Candidate uses: context reconstruction, active state signal set, active tool definition set.
- A snapshot should mostly contain refs, counts, hashes, and bounded summary data.
- Avoid full repeated bodies.

## Expanded Family Control

```ts
type PulseExport =
  | Pulse
  | Flow
  | Definition
  | Change
  | Relationship
  | Snapshot;
```

The expanded family is allowed when a reduced-family mapping becomes too strained.

- `Flow`: execution grouping and flow-level context.
- `Definition`: stable reusable content or schema referenced by runtime exports.
- `Snapshot`: bounded reconstruction checkpoint.

## Devil's Advocate

The reduced family may be too clever. If `Change` represents definitions, context edits, state snapshots, task updates, and config mutations, it risks becoming the same generic string-event problem Pulse is trying to avoid.

The expanded family may be too bureaucratic. If every useful thing gets its own export shape, Pulse stops being a radical simplification and becomes another telemetry object model.

The test in this pass is not "can it be represented somehow." The test is whether the representation stays lean, queryable, and useful for learning systems without reintroducing spans, message snapshots, or UI event logs under new names.

