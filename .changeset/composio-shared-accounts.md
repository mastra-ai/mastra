---
'@mastra/editor': minor
---

Added support for Composio shared connected accounts in `ComposioToolProvider`. Fixes [#18959](https://github.com/mastra-ai/mastra/issues/18959).

**Create shared accounts.** Set `sharedConnections` to create Composio SHARED accounts for connections authorized with `scope: 'shared'`. The optional ACL controls which Composio users can use the account. Without it, Composio's deny-by-default access applies.

```ts
new ComposioToolProvider({
  apiKey: process.env.COMPOSIO_API_KEY!,
  sharedConnections: { acl: { allowAllUsers: true } },
});
```

**Select shared accounts.** The connection picker now lists SHARED accounts, including accounts another user created in the Composio dashboard when their ACL grants access. Pinned SHARED accounts now report the correct connection status.

**Fixed:** Adding a second connection for the same toolkit failed with a multiple connected accounts error. You can connect multiple accounts per toolkit again.
