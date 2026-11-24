---
'@mastra/core': patch
---

Agents now see every Knowledge scope they hold before anything has been written there. Calling `knowledge_read` or `knowledge_list` without a target lists each held scope with the agent's `role` there and what it `can` do (`write`, `read` or `none`), and marks scopes with no page the agent can read yet as `empty`. Before, a scope such as the run's own `resource:`/`thread:` scope only appeared after something had written to it, so on its first turn an agent concluded it had nowhere to read or write. A held scope the agent cannot read shows only its address.
