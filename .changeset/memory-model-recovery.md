---
'@mastra/factory': patch
---

When the observational memory model fails (rejected model, quota, credentials, rate limit, context limit or provider outage), the error now tells you to change the memory model in Memory settings and offers a "Change memory model" action that opens them, in both the Factory chat and Slack. Before, it offered "Change model", which changes the session's chat model and could never fix a failing observer or reflector model.
