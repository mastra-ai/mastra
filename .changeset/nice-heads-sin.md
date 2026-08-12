---
'@mastra/braintrust': patch
---

Fixed suspended and resumed workflow runs appearing as two disconnected traces in Braintrust. Suspended and resumed workflow runs now appear in one Braintrust trace, with the resumed run nested under the span it was suspended from. As part of this change, Braintrust traces are grouped by the Mastra trace ID instead of a random ID, so multiple runs that share an explicitly provided trace ID now appear as one Braintrust trace. Fixes [#20771](https://github.com/mastra-ai/mastra/issues/20771).

**Upgrade note:** a workflow run that was suspended before this upgrade and resumed after it still appears as two Braintrust traces — the older half was grouped under a random ID that the new version cannot recover — and the resumed half may display without a root span. This affects only runs in flight across the upgrade; runs suspended and resumed on the same version are unaffected. If this matters for your traces, drain suspended runs before upgrading.
