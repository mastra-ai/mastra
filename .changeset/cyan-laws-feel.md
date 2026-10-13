---
'@mastra/core': patch
---

Fixed a tool transform configured for one phase only (e.g. transcript output) replacing every other phase's persisted payload with a placeholder — stored tool args became '{"message":"Tool input-available payload unavailable"}', losing the model's actual input and breaking providers that verify replayed tool inputs (Anthropic preserved thinking). Phases without a transformer now persist the original payload; the placeholder remains for transformers that throw and for central policies that return undefined, and input deltas stay suppressed for transformed targets. Fixes #26597
