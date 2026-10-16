---
'@mastra/core': patch
---

Fixed legacy agent defaults and Controller session selectors being ignored during version selection, and retained completed client-tool run identity with the default PubSub.

Preserved version selection when queuing Controller signals. Background-task continuations now retain caller-visible request-context updates while keeping the run's original version pins.
