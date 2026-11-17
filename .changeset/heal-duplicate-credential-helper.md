---
'@mastra/factory': patch
---

Starting a Factory session no longer fails when the session checkout's Git config already holds more than one `credential.helper` value. That can happen when an agent in the sandbox runs `git config --add credential.helper …` while `gh` is unavailable, and the extra value persists in the sandbox filesystem across stops. Session checkout now writes the `gh` credential helper with `git config --replace-all`, so it collapses any existing values back to the single helper it manages instead of erroring with `cannot overwrite multiple values with a single value`. Previously a duplicate made every later start of that session fail at checkout, before the agent ran, until the session (and sandbox) were deleted.
