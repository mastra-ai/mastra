---
'@mastra/factory': patch
---

**Sandbox:** A Factory session's agent can now replace its own sandbox when it stops responding, with the new `factory_recreate_sandbox` tool. Before, a session whose sandbox hung (every command timing out, or "onStart hook failed") stayed stuck until someone pressed Recreate sandbox.

The tool deletes the VM, so anything not committed and pushed is lost; its description tells the agent to push first. The agent keeps working in the same turn: its next command starts a fresh sandbox and runs setup again. Available on Platform sandboxes.
