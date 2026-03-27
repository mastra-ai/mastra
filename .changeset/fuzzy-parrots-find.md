---
'@mastra/react': patch
---

Fixed session cookies not being sent on general API calls in Studio. The MastraClient created by the React provider now includes `credentials: 'include'`, ensuring authenticated endpoints work correctly when using custom servers with auth. Fixes #14770.
