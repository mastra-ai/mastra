---
'@mastra/memory': patch
---

Observational memory observer and reflector runs no longer render their raw observation text to a controller's messaging channel. Previously, when an `AgentController` drove a run through a channel (e.g. Slack), the internal OM runs could inherit the run's channel render context and stream their `<observations>` output back to the thread. Controller channels now attach to the backing agent instance rather than the request context, so the OM observer/reflector agents (their own agent instances, with no channels) never attach the channel output processor and render nothing.
