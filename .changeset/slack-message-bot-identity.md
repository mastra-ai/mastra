---
'@mastra/core': patch
---

Inbound channel messages now carry the bot's own identity next to the author's, so a client can name the id the message text addresses instead of printing `<@U0BMHEJ7RLY>`.

```ts
message.content.providerMetadata.mastra.channels.slack;
// {
//   messageId: '1787155628.734549',
//   author: { userId: 'U0B9NEZ90KH', userName: 'ada', fullName: 'Ada Lovelace' },
//   bot: { userId: 'U0BMHEJ7RLY', userName: 'Mastra Code' },   // new
// }
```
