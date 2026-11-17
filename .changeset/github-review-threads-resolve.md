---
'@mastra/factory': patch
---

Factory agents can now resolve and reopen GitHub pull request review threads with `source_control_resolve_diff_thread`. Before, the tool always failed on GitHub because only GitLab supported resolving review threads. Pass the id of any comment in the thread, including a reply. If the comment is not part of a published thread, the tool says so and explains what to do next.
