---
'@mastra/factory': patch
---

Stop rejecting `factory_transition_work_item` calls from non-triage agents that include a `triageType` key. Sessions are shared across role rotations, so a work or plan agent can copy the triage agent's earlier call shape from history; the strict schema then failed the whole transition with `Unrecognized key: "triageType"`. The key is now accepted and ignored for non-triage bindings; triage bindings still require it, and only they can forward a classification.
