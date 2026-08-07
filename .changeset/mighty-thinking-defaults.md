---
'@mastra/code-sdk': minor
'mastracode': minor
'@mastra/server': patch
'@mastra/client-js': minor
'@mastra/factory': minor
---

Add a reasoning-effort configuration surface across mastracode and Factory (fixes #20766):

- New `max` thinking level (mapped to `reasoning effort: max` for OpenAI Codex and Anthropic `effort`).
- Anthropic extended-thinking wiring: the session thinking level now applies to anthropic/claude-opus-4-7 and other Anthropic models via provider thinking/effort options (previously OpenAI-only).
- New `models.modeThinkingDefaults` setting: per-mode (build/plan/fast) default thinking levels, resolved at request time with precedence session override → mode default → global `preferences.thinkingLevel`. Configuration changes now apply to the next request of every session, including automated Factory runs.
- Factory: new Settings → Defaults controls for editing global and per-mode thinking defaults in local deployments.
- TUI: `/think` now sets a session-only override, supports `/think default` to clear it, and `/think status` reports the effective level with provenance (session override / mode default / global default).

Example `settings.json` configuration:

```json
{
  "preferences": { "thinkingLevel": "medium" },
  "models": {
    "modeThinkingDefaults": {
      "build": "high",
      "plan": "max",
      "fast": "off"
    }
  }
}
```
