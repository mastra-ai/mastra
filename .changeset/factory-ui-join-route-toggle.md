---
'@mastra/factory': patch
'mastra': patch
---

Added a "Join the issue's card instead" switch to intake routes in the Factory UI. A route for pull requests that close an issue can now put the pull request on that issue's card instead of giving it a card of its own; until now only the route Factory seeds could do this. The switch shows on new and saved routes whose conditions include "Source kind is Pull request" and "Pull request closes an issue is Yes".
