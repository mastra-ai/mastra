---
'@mastra/factory': patch
---

Runs on untrusted content keep their own memory. A run on a pull request checkout, or on a GitHub or GitLab card whose author has no write access, no longer shares the Factory's memory resource, so it can't plant observations that trusted runs later read, or read what trusted runs observed. A session that was isolated stays isolated, and a session that already shares the Factory's memory refuses untrusted work.
