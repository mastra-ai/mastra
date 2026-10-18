# Customize policy and jurisdiction

The template includes `demo-default` and `demo-strict` US examples. They demonstrate configuration mechanics and are not jurisdiction-ready compliance policies.

Policy controls include required document sides, required application fields, missing-information rounds, screening thresholds, risk weights, hard stops and reviewer routing. Policies are versioned and pinned into each case so a later configuration change cannot silently rewrite an in-flight decision.

To add a profile:

1. define and validate the policy under `src/config/policies`;
2. register it in the jurisdiction and risk registries;
3. add contract, completeness, risk-route and restart/resume tests;
4. verify both PII modes and update the public configuration guide.

Keep deterministic policy authoritative. Model output may summarize redacted evidence but cannot change score, hard stops, route or reviewer authority. Strong sanctions or PEP candidates require review and are not proof of identity. Every final approve or reject action must remain explicit and auditable.
