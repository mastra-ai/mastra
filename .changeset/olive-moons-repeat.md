---
'@mastra/memory': patch
---

Add a conversation simulation tool that replays real conversation threads through the Subconscious capture and curation pipeline against a local Postgres, so capture and curation prompt changes can be A/B'd on real data locally instead of deployed and observed over days.

```sh
pnpm --filter @mastra/memory simulate:ab -- \
  --input "$SIMULATE_INPUT_URL" \
  --target-prefix "postgres://user@127.0.0.1:5432/simulate_demo" \
  --arm-a ./arm-a.txt \
  --arm-b ./arm-b.txt
```

`--cadence off` disables the driver's own curation calls entirely, so a replay records only
the curations the memory package decided to run by itself — the mode you want when the
question is *when* curation fires rather than what the curator produces.
