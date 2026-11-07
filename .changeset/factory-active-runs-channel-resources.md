---
'@mastra/factory': patch
---

Fixed Factory failing to load while a teammate has a Slack run going. The active-runs list, and memory or session requests naming another person's Slack or channel resource, returned a 500 (`invalid input syntax for type uuid`) instead of hiding that run or answering 404.
