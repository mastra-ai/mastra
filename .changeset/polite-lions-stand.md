---
'@mastra/livekit': minor
---

Added a `configuration` option to `createLiveKitWorker` — one grouped home for conversation and compliance controls, so these don't each become a separate top-level worker option. It ships with greeting/AI-disclosure controls, a consent model, and agent-initiated hang-up, and is where further compliance controls will land.

**Greeting and AI disclosure**

`configuration.greeting` controls the opening line spoken at call start. Set `allowInterruptions: false` so a legally-required AI disclosure plays through and can't be talked over (EU AI Act Art. 50), `awaitPlayout: true` to hold post-greeting work until it finishes, and `repeatEvery` to re-disclose periodically on long calls (spoken at the next turn boundary, never mid-sentence).

```ts
createLiveKitWorker({
  mastra,
  agent: 'support',
  configuration: {
    greeting: {
      text: 'You are speaking with an AI assistant. This call may be recorded. How can I help?',
      allowInterruptions: false,
      awaitPlayout: true,
      repeatEvery: 3 * 60_000, // re-disclose ~every 3 minutes
    },
  },
});
```

**Per-tenant greeting**

`greeting.text` also accepts a resolver, called once per call with the call context, so one multi-tenant agent can open differently per tenant based on the dispatch metadata:

```ts
greeting: {
  text: ({ metadata }) => `Thanks for calling ${tenantName(metadata)}. You're speaking with an AI assistant.`,
  allowInterruptions: false,
}
```

**Consent**

`configuration.consentPolicy` declares which data-use consents a call needs, as a named, extensible set (starting with `summaryStorage`) rather than one global flag. Declaring the policy enforces nothing by itself: the new `createConsentTool` captures the caller's decision at runtime — add it to your agent and it hands each decision to your own store — and your code enforces the requirement at `onCallEnd` (or before any consent-gated step).

```ts
import { createConsentTool } from '@mastra/livekit';

// in your agent's tools:
recordConsent: createConsentTool({
  items: ['summaryStorage'],
  onGrant: async ({ item, granted, resourceId }) => {
    if (resourceId) await db.saveConsent(resourceId, item, granted);
  },
}),
```

**Agent-initiated hang-up**

`configuration.endCall` lets the agent end the call itself. Add the new `createEndCallTool` to your agent and instruct it to say goodbye and then call the tool; the worker waits for the closing words to finish playing, holds a short audio drain (`drainMs`, default 800ms) so the tail of the goodbye isn't clipped while it's still buffered at the caller, then hangs up — running `onCallEnd` on the way out, exactly as a caller hang-up does. It works on both the agent and workflow reply paths.

```ts
import { createEndCallTool } from '@mastra/livekit';

// in your agent's tools:
endCall: createEndCallTool(),

// on the worker:
createLiveKitWorker({ mastra, agent: 'support', configuration: { endCall: {} } });
```

**Backwards compatible**

The previous top-level `greeting` (string) and `persistGreeting` options still work as deprecated aliases for `configuration.greeting.text` and `configuration.greeting.persist`. When both are set, `configuration.greeting` wins field by field, so existing worker configs keep running unchanged.
