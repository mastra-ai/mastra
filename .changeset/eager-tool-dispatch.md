---
'@mastra/core': patch
---

Add an opt-in `eagerToolExecution` option to `agent.stream()`. By default a tool cannot start until the model's streaming step has finished, so a tool whose arguments are already complete waits on later sibling calls and trailing content. With `eagerToolExecution: true`, a complete tool call for an eligible server-side tool starts immediately while the model keeps streaming, and the existing pipeline still owns result ordering and message history.

Eligibility is narrow by design: approval-gated, suspendable, provider-executed, client-side, background-eligible, auto-resumed, missing and inactive tools keep the existing behaviour, as does any run configured with `toolCallConcurrency.strategy: 'called'`. Eager work shares the configured concurrency limit, a caller abort stops further dispatch, and durable agents reject the option. Default behaviour is unchanged when the option is omitted.

If an attempt is discarded after a tool has been dispatched eagerly, meaning the model errored and the request is retried or failed over, that tool is aborted rather than un-run and its result is discarded with the attempt. Leave the option off for tools whose side effects cannot safely be interrupted partway.
