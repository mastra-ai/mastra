---
'@mastra/connect': patch
---

Fixed two problems in provider tool requests. Next-page links that already carry a query string are now merged with the tool's own parameters instead of getting a second `?` appended, which had broken page 2 of some paginated lists. Provider errors that send an empty message but a nested error code (for example Microsoft Graph's `UnknownError`) now include that code in the error message instead of only the HTTP status. See [#26283](https://github.com/mastra-ai/mastra/pull/26283).
