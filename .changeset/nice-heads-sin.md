---
'@mastra/braintrust': patch
---

Fixed suspended and resumed workflow runs appearing as two disconnected traces in Braintrust. Both halves of a run now land in the same Braintrust trace: root spans pin the Braintrust root_span_id to the Mastra trace ID, and a resumed run links to the span it was suspended from via span_parents. Genuine root spans keep is_root: true and traces keep their names. As part of this change, Braintrust groups traces by the Mastra trace ID instead of a random ID, so multiple runs that share an explicitly provided trace ID now appear as one Braintrust trace. Fixes [#20771](https://github.com/mastra-ai/mastra/issues/20771).

**Upgrade note:** a workflow run that was suspended before this upgrade and resumed after it still appears as two Braintrust traces — the older half was grouped under a random ID that the new version cannot recover — and the resumed half may display without a root span. This affects only runs in flight across the upgrade; runs suspended and resumed on the same version are unaffected. If this matters for your traces, drain suspended runs before upgrading.
