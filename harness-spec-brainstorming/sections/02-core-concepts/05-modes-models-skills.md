### 2.5 Modes, Models, Skills

Modes, models, and skills are the three orthogonal selectors a Harness run
composes. Mode picks *which configured agent* (and therefore which
instructions and base tool surface) handles the turn; model picks *which
LLM* drives that agent; skill picks *a specific parameterised prompt* to
hand the agent. They live on different lifetimes and have different sources
of truth, which the rest of the spec relies on when declaring durability,
override scope, and per-turn admission rules.

- **Mode** — a named persona/policy preset (e.g. `"build"`, `"plan"`).
  Carries an `agentId` binding to a configured agent and an optional
  `defaultModelId` bootstrap fallback. The selected agent owns the
  instructions and base tool surface; Harness tool/permission configuration
  and per-turn `addTools` own additional tool exposure. **Lifetime:**
  per-session by default, with an optional per-turn override. A per-turn
  mode override selects that mode's agent for the run without mutating the
  session default. **Where it's pinned:** `SessionRecord.modeId` (§5.1a),
  mutated via `session.switchMode({ mode })` (§4.2). **Catalog and
  validation:** §9 owns the configured mode catalog; §4.3 owns per-turn
  override semantics.

- **Model** — the LLM identity (`provider/model-name`). **Lifetime:**
  per-session, with an optional global default and a per-turn override.
  Once `SessionRecord.modelId` is committed, it is authoritative over the
  config-level default until `session.switchModel({ model })` (§4.2)
  commits a new value. The mode's `defaultModelId` only seeds the session
  at creation/bootstrap when no selected model exists. **Subagent
  overrides:** `SessionRecord.subagentModelOverrides` carries the
  per-agentId remap used when spawning child sessions (§2.4, §5.1a). **Catalog
  and validation:** §9 owns the configured model catalog; §4.3 owns
  per-turn override semantics.

- **Skill** — a named, parameterised prompt loaded from the session
  workspace's configured skill source/resolver or registered programmatically
  (`HarnessConfig.skills`). Invoked explicitly via
  `session.useSkill(name, opts)` (§4.6). **Lifetime:** skills are
  session-scoped — a skill is "available" only when this specific session
  can resolve its name from one of those two sources. Whether two sessions
  share the same set depends on the workspace ownership model (§2.7):
  `shared` exposes the same workspace skills to every session,
  `per-resource` partitions them by tenant, and `per-session` gives each
  session its own. **Where it's pinned:** there is no durable per-session
  "selected skill" — `useSkill` is a one-shot operation; the prompt body
  is materialized into the turn's message log and persisted alongside
  ordinary messages (§5.1a).
