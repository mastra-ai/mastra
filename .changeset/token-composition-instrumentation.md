---
'@mastra/core': patch
---

Added prompt token-composition instrumentation to `MODEL_STEP` spans, so you can see _which parts_ of a prompt your tokens went to instead of only a single input-token total.

Two new optional attributes on `ModelStepAttributes`. Both are additive: nothing existing changes, and the bytes sent to the model do not move. A regression test asserts that the prompt for a fixed scenario is byte-identical to a fixture captured on the base commit.

- `promptRegions`: estimated tokens per prompt region (`system`, `tagged-system:<tag>` for each tagged system message such as memory, `messages`, and `unattributed` for anything injected after prompt assembly). Estimated with the token counter already used by `TokenLimiterProcessor`. The estimation method is emitted alongside the numbers so consumers know these are heuristics to be compared against provider-reported usage, not a substitute for it.
- `promptPrefixChangedFromPreviousStep`: whether this step's prompt prefix diverged from the previous step's, which is what invalidates provider prompt caches for everything below it. The attribute is absent on the first step of a turn rather than set to a value, so read it by key presence.

Both attributes are only computed when a live `MODEL_STEP` span exists, so there is no cost when observability is off.

Also added a session rollup script that turns a dump of exported spans into decision-grade numbers: cache-hit rate, per-region totals, steps-per-turn distribution, and estimate-vs-provider delta.

```bash
npx tsx packages/core/scripts/token-composition-rollup.ts ./session-spans.json
```

Steps where the provider did not report cache details are counted as _unreported_ rather than as zero cached, so a provider that stays quiet cannot silently drag a cache-hit rate toward zero. Output is token counts by type only, with no pricing, since rate cards change.
