# Headless Config File & Model Selection — Design Spec

> **Superseded:** The `headless.json` config file, `--config`, and `--profile` flags were replaced by the `--settings <path>` flag (see decision #16 in `decisions.md`). All model/pack/OM/subagent resolution now happens via `settings.json` at startup in `createMastraCode()`. Headless mode only handles CLI-level overrides (`--model`, `--mode`, `--thinking-level`, `--continue`).

## Overview (historical)

Add a `headless.json` config file and new CLI flags (`--mode`, `--thinking-level`, `--config`) to mastracode's headless mode. Users can configure model selection and preferences via a checked-in config file for CI, or via CLI flags for quick runs. Both approaches work together — flags override config.

## Config File

### Schema

```json
{
  "models": {
    "activeModelPackId": "anthropic",
    "modeDefaults": {
      "build": "anthropic/claude-sonnet-4-5",
      "plan": "openai/gpt-5.4",
      "fast": "cerebras/zai-glm-4.7"
    },
    "activeOmPackId": "anthropic",
    "omModelOverride": null,
    "subagentModels": {
      "explore": "anthropic/claude-haiku-4-5"
    },
    "omObservationThreshold": 0.7,
    "omReflectionThreshold": null
  },
  "preferences": {
    "thinkingLevel": "medium",
    "yolo": true
  }
}
```

All fields are optional. An empty `{}` is valid and falls through to global settings.json defaults.

Shape mirrors the `models` and `preferences` properties from the TUI's runtime `settings.json`, so the same resolution logic can be reused.

**Pack references:** `activeModelPackId` and `activeOmPackId` accept built-in pack IDs (e.g., `"anthropic"`, `"openai"`) that resolve to concrete models at runtime. Explicit `modeDefaults` override `activeModelPackId` when both are present. `custom:<name>` pack IDs are not supported — use `modeDefaults` for custom configurations.

**OM config:** `omModelOverride` directly sets the observer/reflector model (takes precedence over `activeOmPackId`). Thresholds (`omObservationThreshold`, `omReflectionThreshold`) set OM sensitivity; `null` clears them.

**Subagent overrides:** `subagentModels` maps agent types (e.g., `explore`, `plan`, `execute`) to model IDs, overriding pack-derived subagent wiring.

### Named Profiles

Profiles allow named configurations within the same file:

```json
{
  "models": { "modeDefaults": { "build": "anthropic/claude-sonnet-4-5" } },
  "preferences": { "thinkingLevel": "medium", "yolo": true },
  "profiles": {
    "ci": {
      "models": { "modeDefaults": { "build": "anthropic/claude-haiku-4-5" } },
      "preferences": { "thinkingLevel": "off", "yolo": true }
    },
    "review": {
      "preferences": { "thinkingLevel": "high" }
    }
  }
}
```

Each profile has the same shape as the top-level config (`models` + `preferences`). When `--profile <name>` is used, the named profile **replaces** the top-level config entirely — no deep merge. CLI flags still override profile values.

### Loading

1. If `--config <path>` is provided, load only that file. Error if not found.
2. Otherwise, auto-discover: project `.mastracode/headless.json` → global `~/.mastracode/headless.json`.
3. First file found wins (no deep merge between project and global). Matches mcp.json/hooks.json behavior.
4. If no file is found, proceed with flags + global settings only.

### Validation

Parse as JSON. Validate shape against a TypeScript interface. Unknown/invalid fields log a warning to stderr and are ignored — don't hard-fail for forward compatibility. Matches mcp.json behavior.

Invalid `--config` path or unparseable JSON returns exit code 1 with a descriptive error.

### Creation

Users create the file manually. The schema is documented in `--help` output with examples. A TUI export command is a natural follow-up but out of scope.

## CLI Flags

### New flags

| Flag               | Values                                  | Description                                              |
| ------------------ | --------------------------------------- | -------------------------------------------------------- |
| `--mode`           | `build`, `plan`, `fast`                 | Select execution mode; uses that mode's configured model |
| `--thinking-level` | `off`, `low`, `medium`, `high`, `xhigh` | Override thinking/reasoning level                        |
| `--config <path>`  | file path                               | Explicit config file; skips auto-discovery               |
| `--profile <name>` | profile name                            | Use a named profile from the config file                 |

### Updated behavior

`--model <id>` (existing) remains the highest-priority model override.

### Flag conflicts

- `--model` + `--mode`: `--model` wins. Stderr warning: `Warning: --model overrides --mode, ignoring --mode`.
- `--model` + config file models: `--model` wins silently.
- `--mode` + config file: `--mode` selects which mode, config provides the model for that mode.

## Resolution Pipeline

When `runHeadless()` is called:

```
1. Parse CLI flags (--model, --mode, --thinking-level, --config, --profile)
2. Load headless.json (auto-discover or from --config)
3. If --profile, resolve named profile (replaces top-level config)
4. Resolve effective model:
   a. If --model → use it directly (validate exists + has API key)
   b. If --mode → look up that mode's model from:
      config modeDefaults → global settings modeDefaults → built-in default
   c. If neither → default mode is "build". Look up build model from:
      config modeDefaults.build → global settings modeDefaults → harness default
4. Resolve thinking level:
   --thinking-level flag → config preferences.thinkingLevel → global settings → default
5. Resolve yolo:
   config preferences.yolo → global settings → default (current behavior)
6. Apply: switchModel(), set thinking level on harness state
7. Subscribe to events, send message
```

Steps 3b and 3c feed into the same `resolveModelDefaults()` function the TUI uses — the config file's `modeDefaults` gets layered in as an additional source between flags and global settings.

## Error Messages

Stderr in default format, `{"type":"error",...}` in json format:

- Config not found: `Error: Config file not found: ./bad-path.json`
- Invalid JSON: `Error: Failed to parse config file: <parse error>`
- Unknown mode: `Error: --mode must be "build", "plan", or "fast"`
- Flag conflict: `Warning: --model overrides --mode, ignoring --mode` (warning, not error)
- Unknown model / missing API key: same as current `--model` behavior

## Help Output

```
Usage: mastracode --prompt <text> [options]

Headless (non-interactive) mode options:
  --prompt, -p <text>           The task to execute (required, or pipe via stdin)
  --continue, -c                Resume the most recent thread
  --timeout <seconds>           Exit with code 2 if not complete within timeout
  --format <type>               Output format: "default" or "json" (default: "default")
  --model <id>                  Model override (e.g., "anthropic/claude-sonnet-4-5")
  --mode {build|plan|fast}      Execution mode (uses that mode's configured model)
  --thinking-level <level>      Thinking level: off, low, medium, high, xhigh
  --config <path>               Path to headless config file (default: .mastracode/headless.json)

Examples:
  mastracode --prompt "Fix the bug"
  mastracode --prompt "Fix the bug" --mode fast --thinking-level high
  mastracode --config ./ci.json --prompt "Run tests"
```

## Implementation

### Files to modify

- **`headless.ts`** — Add `--mode`, `--thinking-level`, `--config` to `parseHeadlessArgs()`. Expand pre-flight checks in `runHeadless()` to load config, resolve model, apply thinking level. Update `printHeadlessUsage()`.
- **`headless.test.ts`** — Unit tests for new arg parsing.
- **`headless-integration.test.ts`** — Integration tests: config loading, precedence, mode resolution, conflict warning, error cases.

### New file

- **`headless-config.ts`** — Config file discovery (project → global), JSON parsing, validation, and the `HeadlessConfig` type definition. Keeps config logic isolated from the main headless flow.

### Not modified

- `settings.ts`, `packs.ts`, harness internals — read from, not changed. Config feeds into existing resolution functions.

## Out of Scope

- `custom:<name>` pack IDs — reference TUI state; use `modeDefaults` for custom configs
- TUI export command
- Config file auto-generation

These can be added in future releases without breaking the schema.
