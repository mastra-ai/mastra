---
'@mastra/evals': minor
---

Prebuilt code scorers and quick checks now accept optional `id` and `name` overrides, so the same factory can be used more than once in a single `runEvals` call without the results colliding. For example: `createTrajectoryAccuracyScorerCode({ id: 'fetch-weather-ran', expectedTrajectory: [...] })` or `checks.includes('London', { id: 'mentions-city' })`. Defaults are unchanged.
