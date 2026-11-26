---
'@mastra/core': patch
---

When someone other than the person who started an agent run approves a paused tool call, the call now runs as the approver. Before, it could run as the person who started the run, depending on which server handled the approval.

After the approval, the run also offers the model the approver's tools, on the same server, on another server, and after crash recovery. If the paused call is to a tool the approver doesn't have, it now fails with a tool error instead of running as the person who started the run. Call-time `toolsets` from the starting call are kept when the approval doesn't pass its own.
