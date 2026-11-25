---
'@mastra/core': patch
---

Agents now receive Slack mentions as Slack's native `<@U123|Display Name>` token instead of a bare display name, so they can mention people back in replies. The label comes from the Slack adapter's user cache or the label already on the token; a mention whose user isn't cached and has no label stays a plain `@name`.
