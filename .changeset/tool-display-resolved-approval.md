---
'@mastra/core': patch
---

A function-form `toolDisplay` on a channel adapter can now render the approval card's final state after a user clicks Approve or Deny. Previously, Mastra always replaced a custom approval card with its own English "Approved" or "Denied" text, which also showed the tool's internal registry key.

The function now receives `approved` and `denied` events (`denied` includes `byUser`). Return `{ kind: 'post', message }` to replace the card:

```ts
channels: {
  adapters: {
    slack: {
      adapter: createSlackAdapter(),
      toolDisplay: event => {
        if (event.kind === 'approved') return { kind: 'post', message: 'Onaylandı' };
        if (event.kind === 'denied') return { kind: 'post', message: `Reddedildi: ${event.byUser ?? ''}` };
        return undefined;
      },
    },
  },
},
```

If the function returns nothing, a blank message, or throws, the default card is shown.

If your function switches exhaustively on `event.kind`, add cases for the two new kinds:

```ts
case 'approved':
  return { kind: 'post', message: 'Approved' };
case 'denied':
  return { kind: 'post', message: `Denied${event.byUser ? ` by ${event.byUser}` : ''}` };
```
