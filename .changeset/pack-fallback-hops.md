---
'@mastra/code-sdk': patch
'mastracode': patch
---

Added fallback model packs and pack-specific subscription routing. In `/models`, you can configure a fallback chain and choose a preferred OAuth account for each model in a pack. Requests try the preferred account, then the provider's remaining accounts in insertion order. Exhausted accounts stay skipped for that model and thread, and a fallback pack applies its own routing. Pack hops remain visible in the transcript and persist when you reopen the thread.

Configure both from `/models` — select a pack, then:

```
/models
  → Set fallback…            # choose the pack to hop to when this pool is exhausted
  → Set subscription routing… # per model: preferred account or Automatic
```

Custom packs can also define an observational memory model. When set, the OM observer and reflector resolve from the active pack and its fallback chain — so OM keeps working when a pack's provider is down. Packs without an OM model keep using your standalone OM configuration, and explicit `/om` overrides still win.

Both settings live in `settings.json` if you prefer to edit them directly. Custom packs can also carry a memory model, which rides the same fallback chain:

```json
{
  "customModelPacks": [
    {
      "name": "Daily",
      "models": {
        "build": "anthropic/claude-sonnet-4-6",
        "memory": "anthropic/claude-haiku-4-5"
      }
    }
  ],
  "models": {
    "packFallbacks": { "custom:Daily": "anthropic" },
    "packAccountPreferences": {
      "custom:Daily": { "anthropic/claude-sonnet-4-6": "anthropic:a1b2c3d4" }
    }
  }
}
```
