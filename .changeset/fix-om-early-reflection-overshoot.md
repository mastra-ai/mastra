---
'@mastra/memory': patch
---

Fixed early observational memory activations so buffered reflections are only activated when they still leave a healthy active observation set.

Before this change, idle-timeout (`activateAfterIdle`) and model/provider-change (`activateOnProviderChange`) activations could swap in a buffered reflection too early. In bad cases, that replaced a large raw observation tail with a much smaller mostly-compressed result, which hurt reflection quality.

Early activations now stay buffered unless both of these checks pass:

- The unreflected observation tail is at least as large as the buffered reflection, so the activated result is not dominated by compressed content.
- The combined post-activation size is at least 75% of what a normal threshold activation would produce, so early activations do not cliff far below the regular target.

This update also fixes false `provider_change` activations when older persisted messages only contain a bare model id like `gpt-5.4` while newer turns use the fully qualified `provider/modelId` form.
