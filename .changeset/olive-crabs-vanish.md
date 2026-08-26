---
'@mastra/github-signals': minor
---

Added multi-PR GitHub signal tools and improved notification filtering.

Agents can subscribe to multiple pull requests, unsubscribe from multiple pull requests, and unsubscribe from all tracked pull requests. The tool input shape now uses a `prs` array instead of the old single-PR top-level fields.

Before:

```json
{ "owner": "mastra-ai", "repo": "mastra", "number": 123 }
```

After:

```json
{ "prs": [{ "owner": "mastra-ai", "repo": "mastra", "number": 123 }] }
```

Unsubscribe all:

```json
{ "all": true }
```

GitHub signal notifications now also filter repeated low-value bot comments such as skipped CodeRabbit reviews and bot status summaries.
