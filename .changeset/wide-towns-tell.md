---
'@mastra/core': minor
'@mastra/deployer': patch
---

Added file-system routing for a Mastra logger and per-agent scorers.

Define a logger in `src/mastra/logger.ts` (default export) and it is auto-registered as the Mastra logger, just like `storage.ts` and `observability.ts`. A code-registered logger still wins.

Register scorers per agent by adding an `agents/<name>/scorers/` folder. Each module's default export (a `MastraScorer`, or a `{ scorer, sampling }` entry) is wired into that agent, keyed by filename. `config.scorers` wins on collision.

```
src/mastra/
  logger.ts                 # export default new PinoLogger({ name: 'App' })
  agents/weather/
    config.ts
    scorers/
      relevance.ts          # export default myRelevanceScorer
```
