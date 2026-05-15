# Subconscious API Implementation Brief

This is a handoff for an agent starting work on the proposed `new Subconscious()` / `new ObservationalMemory()` API. The goal is to turn Observational Memory (OM) extractor outputs into durable background learning by routing structured insights to background psyche agents such as `learner`, `critic`, `dreamer`, and `modeler`.

## Context

Mastra already has Observational Memory concepts: an observer, a reflector, and extractor hooks. The new idea adds a first-class **Subconscious** layer:

```txt
foreground Agent
  -> Observational Memory observation/reflection
  -> psyche extractors
  -> Subconscious background agents
  -> durable artifacts: knowledge, skills, mental model, policies
```

The foreground agent should keep doing task work. The subconscious agents should own durable learning/integration work asynchronously.

## Product intent

The API should make this easy:

```ts
const subconscious = new Subconscious({
  workspace,
});

const memory = new ObservationalMemory({
  subconscious,
  observation: { psyches: ['critic', 'learner'] },
  reflection: { psyches: ['dreamer', 'modeler'] },
});
```

Meaning:

- During observation, OM extracts fast/background reactions for `critic` and `learner`.
- During reflection, OM extracts slower consolidation outputs for `dreamer` and `modeler`.
- Extracted sections are automatically sent as signals to the matching background psyche agent unless the user overrides routing.
- Each psyche is a normal Mastra `Agent` with an inbox thread, model, instructions, tools, memory, and optional OM of its own.

## Naming decisions

Use these names unless implementation constraints force a change:

- `Subconscious` — the background-mind subsystem.
- `psyches` — the selected background aspects/agents to activate.
- Built-in psyche names:
  - `learner` — extracts durable lessons, workflow improvements, and skill candidates.
  - `critic` — detects contradictions, risks, policy/security concerns, and review needs.
  - `dreamer` — synthesizes across observations, finds non-obvious patterns, generates hypotheses.
  - `modeler` — updates mental/world/self/task models.
  - Optional/future: `integrator`, `skillLearner`, `policy`.
- Prefer `sendSignal()` and `sendSignals()` over `route()` for delivery naming. `route()` felt too abstract; signals make the async boundary explicit.

`minds` is the best alternative name if `psyches` feels too mystical for external docs. Do **not** use `faculties`; it sounded too academic/schooly.

## API tiers

### Tier 1: simple sugar

```ts
const subconscious = new Subconscious({ workspace });

const memory = new ObservationalMemory({
  subconscious,
  observation: {
    psyches: ['critic', 'learner'],
  },
  reflection: {
    psyches: ['dreamer', 'modeler'],
  },
});
```

This is the preferred docs/demo path.

### Tier 2: phase-local advanced options

`psyches` should support an object form in addition to the array shorthand:

```ts
const memory = new ObservationalMemory({
  subconscious,
  observation: {
    psyches: {
      active: ['critic', 'learner'],
      models: {
        critic: anthropic('claude-3-7-sonnet-latest'),
      },
      schemas: {
        critic: z.object({
          risks: z.array(z.object({
            title: z.string(),
            description: z.string(),
            severity: z.enum(['low', 'medium', 'high']),
            evidence: z.array(z.string()),
          })),
          contradictions: z.array(z.string()).default([]),
          needsReview: z.boolean(),
        }),
        learner: z.object({
          lessons: z.array(z.object({
            insight: z.string(),
            confidence: z.number().min(0).max(1),
            evidence: z.array(z.string()),
          })),
          skillCandidates: z.array(z.object({
            name: z.string(),
            description: z.string(),
            evidence: z.array(z.string()),
          })),
          knowledgeDeltas: z.array(z.string()).default([]),
          mentalModelDeltas: z.array(z.string()).default([]),
        }),
      },
      onExtracted: async ({ subconscious, extracted, threadId, resourceId }) => {
        if (extracted.critic?.needsReview) {
          await subconscious.critic.sendSignal({
            type: 'om.subconscious.critic.review-needed',
            contents: extracted.critic,
            attributes: { threadId, resourceId },
          });
        }

        if (extracted.learner) {
          await subconscious.learner.sendSignal({
            type: 'om.subconscious.learner.extracted',
            contents: extracted.learner,
            attributes: { threadId, resourceId },
          });
        }
      },
    },
  },
});
```

### Tier 3: explicit extractor composition

For lower-level users, `subconscious.psyches(...)` should return an OM extractor (or extractor list/adapter) that can be placed inside existing `extract: []` arrays:

```ts
const memory = new ObservationalMemory({
  subconscious,
  observation: {
    extract: [
      subconscious.psyches({
        active: ['critic', 'learner'],
        onExtracted: async ({ subconscious, extracted }) => {
          await subconscious.sendSignals(extracted);
        },
      }),
    ],
  },
});
```

Document `subconscious.psyches()` as returning OM extractors/adapters, **not** psyche agents.

### Tier 4: custom psyches

Users should be able to define custom psyche agents with schemas. Prefer a single `psyches` object where each key maps to `{ agent, schema }` or config that can create an agent.

```ts
const subconscious = new Subconscious({
  workspace,
  model: openai('gpt-4.1-mini'),
  psyches: {
    codeReview: {
      agent: new Agent({
        id: 'code-review-psyche',
        name: 'Code Review Psyche',
        model: openai('gpt-4.1'),
        instructions: 'Review extracted coding patterns, regressions, and maintainability risks.',
      }),
      schema: z.object({
        findings: z.array(z.object({
          file: z.string().optional(),
          issue: z.string(),
          severity: z.enum(['nit', 'warning', 'blocking']),
          suggestedFix: z.string().optional(),
        })),
      }),
    },
    policy: {
      agent: new Agent({
        id: 'policy-psyche',
        name: 'Policy Psyche',
        model: openai('gpt-4.1-mini'),
        instructions: 'Evaluate whether extracted lessons imply policy updates or compliance review.',
      }),
      schema: z.object({
        policyDeltas: z.array(z.string()),
        requiresHumanApproval: z.boolean(),
      }),
    },
  },
});
```

## Proposed class shapes

These are conceptual, not final signatures.

```ts
type BuiltInPsycheName = 'learner' | 'critic' | 'dreamer' | 'modeler';

type PsycheName = BuiltInPsycheName | string;

type PsycheDefinition<TSchema extends z.ZodTypeAny = z.ZodTypeAny> = {
  agent?: Agent;
  model?: Model;
  instructions?: string;
  schema?: TSchema;
  memory?: Memory | ObservationalMemory | MemoryConfig;
  tools?: Record<string, Tool>;
};

type SubconsciousOptions<TPsyches extends Record<string, PsycheDefinition> = {}> = {
  workspace?: SubconsciousWorkspace;
  model?: Model;
  instructions?: string | Partial<Record<PsycheName, string>>;
  memory?: Memory | ObservationalMemory | MemoryConfig;
  psyches?: TPsyches;
  psycheDefaults?: Partial<PsycheDefinition>;
};

class Subconscious<TPsyches extends Record<string, PsycheDefinition> = {}> {
  constructor(options: SubconsciousOptions<TPsyches>);

  psyches(names: PsycheName[]): Extractor;
  psyches(options: PsycheExtractionOptions<TPsyches>): Extractor;

  sendSignals(extracted: Record<string, unknown>, context?: SignalContext): Promise<void>;

  // Dynamic per-psyche properties are desirable if TypeScript can support them:
  // subconscious.critic.sendSignal(...)
  // subconscious.learner.sendSignal(...)
}
```

`ObservationalMemory` should be a convenience wrapper around `Memory` focused on OM configuration:

```ts
class ObservationalMemory extends Memory {
  constructor(options: {
    id?: string;
    storage?: Storage;
    vector?: VectorStore;
    embedder?: Embedder;
    subconscious?: Subconscious;
    observation?: ObservationalMemoryPhaseConfig;
    reflection?: ObservationalMemoryPhaseConfig;
    // plus existing Memory options as needed
  });
}
```

Use `reflection`, not `reflector`, in the public convenience API. Internally it can compile down to existing `reflector` config if that is the current lower-level shape.

## Compilation behavior

The high-level sugar should compile down to current OM extractor config.

Example:

```ts
new ObservationalMemory({
  subconscious,
  observation: { psyches: ['critic', 'learner'] },
});
```

Should become roughly:

```ts
new Memory({
  options: {
    observationalMemory: {
      observation: {
        extract: [subconscious.psyches(['critic', 'learner'])],
      },
    },
  },
});
```

If existing OM already has `observation.extract`, preserve and append/merge instead of overwriting.

## Extraction behavior

A psyche extractor should ask the OM observer/reflector to emit one structured section per active psyche. Conceptually:

```xml
<critic>{"risks":[],"contradictions":[],"needsReview":false}</critic>
<learner>{"lessons":[],"skillCandidates":[],"knowledgeDeltas":[],"mentalModelDeltas":[]}</learner>
```

Rules:

- Each active psyche has a slug equal to its key (`critic`, `learner`, etc.).
- Each psyche has a Zod schema.
- Built-in psyches provide default schemas and default extraction instructions.
- User schemas override built-in schemas phase-locally or at `Subconscious` construction.
- Extracted values should validate through the schema before routing.
- Invalid/missing sections should not crash the main observation cycle. Log/debug and skip that psyche.
- Empty/no-op outputs should not wake psyche agents unless configured.

## Default routing

When `onExtracted` is absent, default behavior should be:

```txt
extracted.critic  -> subconscious.critic.sendSignal(...)
extracted.learner -> subconscious.learner.sendSignal(...)
extracted.dreamer -> subconscious.dreamer.sendSignal(...)
extracted.modeler -> subconscious.modeler.sendSignal(...)
```

Default signal shape:

```ts
await subconscious[psycheName].sendSignal({
  type: `om.subconscious.${psycheName}.extracted`,
  contents: extracted[psycheName],
  attributes: {
    source: 'observational-memory',
    phase: 'observation' | 'reflection',
    threadId,
    resourceId,
    agentId,
    causationId,
    depth,
  },
});
```

Use stable inbox threads for psyche agents. Suggested thread ID shape:

```txt
subconscious:<scope-id>:<psyche-name>
```

Where `scope-id` might be resource/team/agent depending on configured scope. Start with resource or agent scope if a broader team scope does not exist yet.

## `onExtracted` behavior

`onExtracted` is optional. If supplied, it should override or augment default routing. Decide explicitly during implementation whether:

1. `onExtracted` replaces default routing, or
2. `onExtracted` runs before/after default routing and can return `{ skipDefault: true }`.

Recommended: **replace default routing** for v1. It is simpler and avoids duplicate signals. Users can call `subconscious.sendSignals(extracted)` manually.

Hook context should include:

```ts
type PsycheOnExtractedContext<TExtracted> = {
  subconscious: Subconscious;
  extracted: TExtracted;
  threadId?: string;
  resourceId?: string;
  agentId?: string;
  phase: 'observation' | 'reflection';
  requestContext?: RequestContext;
  observations?: unknown;
  sourceMessages?: unknown[];
};
```

## Built-in psyche responsibilities

### `learner`

Purpose: turn repeated experience into durable behavior improvements.

Default output should include:

- lessons learned;
- skill candidates;
- knowledge deltas;
- mental-model deltas;
- confidence and evidence.

### `critic`

Purpose: catch problems before they become durable updates or user-facing behavior.

Default output should include:

- risks;
- contradictions;
- policy/security concerns;
- `needsReview` boolean;
- severity and evidence.

### `dreamer`

Purpose: slow synthesis and speculative cross-thread pattern finding.

Default output should include:

- hypotheses;
- unexpected connections;
- future experiments;
- low-confidence ideas;
- evidence/provenance.

Should usually run in reflection/deferred contexts, not every fast observation turn.

### `modeler`

Purpose: maintain mental/world/task models.

Default output should include:

- belief updates;
- causal assumptions;
- changed priorities;
- stale assumptions;
- unknowns/questions;
- confidence and evidence.

## Workspace expectations

`Subconscious` should accept a `workspace` option. This workspace is the durable substrate psyche agents can read/write.

For local Agent Co-op style, assume directories like:

```txt
workspace/
  knowledge/
  skills/
  mental-model/
  policies/
  artifacts/
```

Do not hard-code this exact layout unless the broader Agent Co-op workspace format already exists. Treat it as a conceptual interface:

```ts
type SubconsciousWorkspace = {
  knowledge?: unknown;
  skills?: unknown;
  mentalModel?: unknown;
  policies?: unknown;
  artifacts?: unknown;
};
```

The first implementation can pass workspace metadata/tools to psyche agents rather than building a full storage abstraction.

## Model/config precedence

Use a cascading override hierarchy:

1. Built-in Mastra defaults.
2. `new Subconscious({ model })` global default.
3. `new Subconscious({ psyches: { [name]: { model } } })` per-psyche default.
4. Phase-local `psyches: { models: { [name]: model } }` override.
5. Custom `agent: new Agent({ model })` wins over generated-agent defaults.

Same idea for `instructions`, `schema`, and `memory`.

## Recursive OM guardrails

Subconscious agents may use OM themselves, but defaults must prevent runaway loops.

Required guardrails:

- Subconscious-agent OM should default quieter than foreground-agent OM.
- Reflection/dreamer work should be deferred/scheduled where possible.
- Mark signals with `source: 'subconscious'`, `depth`, and `causationId`.
- Suppress self-wake loops by default.
- Bound downstream routing: e.g. `critic` can signal `learner`, but should not endlessly signal itself.
- Only notify the foreground agent when the integrated change affects the current run.

Example desired config shape:

```ts
const subconscious = new Subconscious({
  workspace,
  model: openai('gpt-4.1-mini'),
  memory: new ObservationalMemory({
    observation: { psyches: ['learner'] },
    reflection: { psyches: ['modeler'] },
  }),
});
```

or per psyche:

```ts
const subconscious = new Subconscious({
  workspace,
  psyches: {
    learner: {
      memory: new ObservationalMemory({
        observation: { psyches: ['critic'] },
      }),
    },
  },
});
```

## Implementation plan

1. **Locate current OM extractor implementation.**
   - Find `Extractor` class/factory implementation and `observation.extract` plumbing.
   - Confirm current XML/structured extraction parsing and `onExtracted` lifecycle.
   - Confirm how `reflector.extract` or equivalent reflection-phase extractors are represented.

2. **Add `Subconscious` core class.**
   - Store global options, built-in psyche definitions, custom psyche definitions.
   - Instantiate or lazily create psyche agents.
   - Expose `subconscious.psyches(...)` as extractor factory/adapter.
   - Expose `sendSignals(extracted, context)` for default fan-out.

3. **Add built-in psyche definitions.**
   - Default schema.
   - Default extraction instructions.
   - Default agent instructions.
   - Default signal type.

4. **Add `ObservationalMemory` convenience wrapper.**
   - Accept root `subconscious`.
   - Accept `observation.psyches` and `reflection.psyches` sugar.
   - Compile sugar to existing `Memory({ options: { observationalMemory } })` shape.
   - Preserve existing lower-level config and `extract: []` behavior.

5. **Wire type inference.**
   - `Subconscious<{ codeReview: { schema: typeof schema } }>` should infer `extracted.codeReview` in `onExtracted`.
   - Built-ins should infer useful defaults.
   - If dynamic property typing for `subconscious.codeReview` is too hard, expose `subconscious.get('codeReview')` as an escape hatch while still supporting built-in properties.

6. **Add tests.**
   - Array shorthand compiles to extractor.
   - Object form passes active psyches, schemas, and `onExtracted`.
   - Default routing sends signals to expected psyche agents.
   - Custom psyche schema validates and types extracted output.
   - Invalid extraction does not break the parent observation cycle.
   - Reflection-phase psyches work separately from observation-phase psyches.
   - Existing `observation.extract` users are not broken.

7. **Add docs/examples.**
   - Simple `new Subconscious({ workspace })` + `new ObservationalMemory(...)` example.
   - Advanced `onExtracted` example with direct `sendSignal()` calls.
   - Custom psyche example.
   - Guardrails/recursion caveat.

## Open questions

Resolve these before committing to public API docs:

1. Should `onExtracted` replace default routing or run in addition to it? Recommendation: replace for v1.
2. Should the public phase key be `reflection` while internals stay `reflector`? Recommendation: yes.
3. Should `Subconscious` live in `@mastra/memory`, `@mastra/core`, or a new package? Likely `@mastra/memory` if tightly coupled to OM extractors.
4. What is the minimal `workspace` interface for v1? Avoid overbuilding storage adapters.
5. Should built-in psyche agents be eagerly constructed or lazy on first signal? Lazy is likely better for cost/startup.
6. How should team/role scope be represented before Agent Co-op runtime primitives are finalized?
7. Should built-in `integrator` exist as separate from `learner`, or is `learner` the first durable-writing agent? Current leaning: `learner` for the public simple path; `integrator` remains a useful internal/future name.

## Non-goals for first pass

- Do not build a full Agent Co-op runtime.
- Do not build a complete filesystem/wiki/skill storage system.
- Do not add broad policy/approval workflows beyond signal routing hooks.
- Do not make subconscious agents recursively wake themselves by default.
- Do not require users to understand extractor internals for the simple path.

## Success criteria

A good first implementation lets a user write this:

```ts
const subconscious = new Subconscious({ workspace });

const memory = new ObservationalMemory({
  subconscious,
  observation: { psyches: ['critic', 'learner'] },
  reflection: { psyches: ['dreamer', 'modeler'] },
});
```

And get:

- valid OM extractors generated under the hood;
- structured outputs validated per psyche;
- default async signal fan-out to psyche agents;
- a clear escape hatch for custom routing via `onExtracted`;
- custom psyche support with `{ agent, schema }`;
- no regressions for existing `Memory` / OM users.

