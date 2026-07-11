---
'@mastra/memory': patch
---

Fixed observational memory observer and reflector runs leaking their raw observation text to a controller's messaging channel. When an `AgentController` drives a run through a channel (e.g. Slack), it stamps its channels onto the run's request context; the internal OM runs cloned that context verbatim and resolved the same channel, streaming their `<observations>` output back to the thread. The controller channels are now stripped from the cloned context so OM observer/reflector runs render nothing.
