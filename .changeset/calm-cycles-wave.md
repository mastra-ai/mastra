---
'@mastra/client-js': minor
---

Added experimental A2A Agent Card signature verification to `getAgentCard`.

**Example**

```ts
const card = await a2a.getAgentCard({
  verifySignature: {
    algorithms: ['ES256'],
    keyProvider: async ({ kid, jku }) => {
      return fetchTrustedPublicJwk({ kid, jku });
    },
  },
});
```

When verification is configured, `client-js` now verifies signed Agent Cards when the server includes `signatures`. Unsigned cards are still returned unchanged.

This also adds the new exported types `GetAgentCardOptions`, `VerifyAgentCardSignatureOptions`, `AgentCardVerificationKey`, and `AgentCardSignatureKeyProviderInput`.
