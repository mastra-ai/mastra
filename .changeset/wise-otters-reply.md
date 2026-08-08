---
'@mastra/slack': patch
---

`SlackProvider` now accepts the `textFormat` option and passes it through to the Slack adapter config, so provider users can set `textFormat: 'plain'` to post agent replies as literal plain text instead of the new markdown default. When unset, the option is omitted and the core markdown default applies.

```typescript
const slack = new SlackProvider({
  refreshToken: process.env.SLACK_APP_CONFIG_REFRESH_TOKEN,
  textFormat: 'plain',
});
```
