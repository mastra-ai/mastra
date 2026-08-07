---
'@mastra/slack': patch
---

`SlackProvider` now accepts the `textFormat` option and passes it through to the Slack adapter config, so provider users can set `textFormat: 'plain'` to post agent replies as literal plain text instead of the new markdown default. When unset, the option is omitted and the core markdown default applies.
