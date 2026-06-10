---
"@mastra/core": patch
---

fix(agent): apply toModelOutput transform to client tool results in sendToolApproval continuation

Client tools execute on the client and send results back via sendToolApproval. Unlike server tools which go through llm-mapping-step where toModelOutput runs, client tool results arrived pre-formed with output: { type: 'json', value: result }, bypassing the toModelOutput transform entirely. This caused multimodal output (images, files) from client tools to be stringified instead of sent as proper inlineData to the model.

The fix applies each tool's toModelOutput transform to incoming tool-result parts in sendToolApproval before passing messages to continueWithMessages.

Fixes #17792
