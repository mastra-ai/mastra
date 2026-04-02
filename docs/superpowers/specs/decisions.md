# Headless Config File — Design Decisions

## 1. Scope: headless only

Config file applies to headless/non-interactive mode only. TUI already has its own settings flow via `/models-pack`, `/om`, `/think`, etc. Project-level TUI config could be a follow-up.

## 2. Config file, not just flags

Mastracode has ~10+ model knobs (build/plan/fast/observer/reflector models, thinking level, subagent overrides, OM thresholds). Adding a flag for each would make CLI invocations unwieldy. A config file bundles them. CC uses flags-only, OC uses config-file-only — we support both.

## 3. Mirror settings.json shape

`headless.json` mirrors the `models` and `preferences` properties from the TUI's runtime `settings.json`. Rationale: reuses existing resolution logic, no translation layer needed, and users familiar with the TUI settings will recognize the structure.

## 4. Named profiles (added later)

Initially rejected profiles as added complexity. Reconsidered after feedback from Daniel Lew — named profiles map well to mastracode's "model packs" concept and simplify CI workflows with multiple configurations (e.g., `ci` vs `review`).

Profiles live inside the same config file under a `profiles` key. Each profile has the same shape as the top-level config (`models` + `preferences`). When `--profile <name>` is used, the named profile **replaces** the top-level config entirely (no deep merge). This keeps the mental model simple: a profile is a complete configuration, not a patch.

CLI flags (`--model`, `--thinking-level`) still override profile values, matching existing precedence behavior.

## 5. CLI flags override config file

Precedence (highest to lowest):

1. `--model <id>` — use this exact model
2. `--mode build|plan|fast` — use the model assigned to that mode
3. `--thinking-level` — overrides config/profile thinking level
4. `--profile <name>` — selects named profile block from config
5. `headless.json` config file top-level (implicit default)
6. Global `settings.json` (TUI defaults)

## 6. Config file location

Follows existing `.mastracode/` convention (same as mcp.json, hooks.json):

- Project-level: `.mastracode/headless.json`
- Global-level: `~/.mastracode/headless.json`
- Project overrides global

## 8. v1 scope: core config only

Config file initially supported only `modeDefaults` (build/plan/fast), `thinkingLevel`, and `yolo`.

## 14. Pack references — built-in only, no custom: IDs

`models.activeModelPackId` and `models.activeOmPackId` allow referencing built-in pack IDs (e.g., `"anthropic"`, `"openai"`) to resolve models at runtime via `getAvailableModePacks()` / `getAvailableOmPacks()`. This is simpler than listing 3+ models explicitly and auto-updates when pack definitions change.

**Custom pack IDs (`custom:<name>`) are not supported.** Custom packs reference TUI state stored in settings.json — they are not portable across machines or CI environments. Users should use `modeDefaults` for custom configurations. A warning is emitted if a `custom:` pack ID is encountered.

**Precedence:** explicit `modeDefaults` override `activeModelPackId` when both are present (same as TUI: manual overrides clear pack reference). `subagentModels` overrides pack-derived subagent wiring.

## 15. OM config and subagent overrides in headless config

Added `activeOmPackId`, `omModelOverride`, `subagentModels`, `omObservationThreshold`, and `omReflectionThreshold` to mirror the full settings.json models shape. `omModelOverride` takes precedence over `activeOmPackId` (same as the `omModelOverride` string | null pattern in settings.json).

## 7. New CLI flags

- `--mode {build|plan|fast}` — select execution mode (uses that mode's configured model)
- `--thinking-level {off|low|medium|high|xhigh}` — override thinking/reasoning level
- `--config <path>` — explicit config file path, skips auto-discovery
- `--model` (existing) — direct model override, highest priority

## 9. Approach: config file with flag overrides

Chose "both ways" approach over config-only (OC-style) or flags-only (CC-style). Flags for quick one-off runs, config for reproducible CI runs. Matches reviewer's "we should support both ways" feedback.

## 10. Config loading: first-file-wins, no deep merge

Project `.mastracode/headless.json` overrides global `~/.mastracode/headless.json`. No deep merge between the two — first file found wins. Matches mcp.json behavior. `--config` bypasses auto-discovery entirely.

## 11. Flag conflict resolution

- `--model` + `--mode`: `--model` wins, stderr warning that `--mode` is ignored
- `--model` + config file models: `--model` wins
- `--mode` + config file models: `--mode` selects the mode, config provides the model for that mode

## 13. Config file is manually created

User creates headless.json by hand. Schema is documented in `--help` output with an example. Deferred: a TUI `/export-headless` command that dumps current config as headless.json (natural follow-up once both sides are stable).

## 12. Validation: warn, don't fail

Invalid/unknown fields in headless.json log a warning to stderr and are ignored. Don't hard-fail on unknown keys for forward compatibility. Matches mcp.json behavior.

## 16. Single settings file — replace headless.json with --settings flag

Daniel's feedback: there should be one settings file concept, not two. The separate `headless.json` config duplicated work that `createMastraCode()` already does via `settings.json` (pack resolution, OM config, subagent wiring, threshold application).

**Change:** Removed `headless.json` and the `--config`/`--profile` flags. Added `--settings <path>` flag that passes a custom path to `loadSettings()`. Without the flag, the default global `settings.json` is used.

**Profiles are replaced by separate settings files** (e.g., `settings-ci.json`, `settings-review.json`). This is simpler and more portable — each file is a complete, standalone configuration.

**What headless mode now does:** Only CLI-level overrides — `--model`, `--mode` (looks up `effectiveDefaults`), `--thinking-level`, and `--continue`. All model/pack/OM/subagent resolution happens once at startup in `createMastraCode()`.

This supersedes decisions 1, 3, 4, 6, 8, 9, 10, 12, 13, 14, and 15 which described the now-removed headless.json system.
