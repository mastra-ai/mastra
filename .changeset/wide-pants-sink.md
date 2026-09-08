---
'@mastra/observability': patch
---

Fixed the `indexed` redaction style of `SensitiveDataFilter` giving the same value a new token every time a span was exported. A span is processed again for each `span_started`, `span_updated`, and `span_ended` event, and the filter treated its own `[APIKEY_1]` token as a new secret and replaced it with `[APIKEY_2]`. Already redacted values now keep their token, so the same secret maps to one token across every span and event of a trace while the trace's mapping is retained (state is kept for the 1000 most recently seen traces). Fixes #23056
