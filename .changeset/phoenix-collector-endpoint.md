---
'@mastra/arize': patch
---

Align the Arize exporter's Phoenix endpoint env var with Arize Phoenix's documented convention.

The exporter now reads `PHOENIX_COLLECTOR_ENDPOINT` first, which matches the variable Arize Phoenix uses across its own SDKs and documentation. `PHOENIX_ENDPOINT` continues to work as a fallback so existing configurations are not affected. Explicit `endpoint` config still takes precedence over both env vars.

```bash
# New (preferred) — matches Arize Phoenix's documented convention
PHOENIX_COLLECTOR_ENDPOINT=http://localhost:6006/v1/traces

# Still supported for backwards compatibility
PHOENIX_ENDPOINT=http://localhost:6006/v1/traces
```
