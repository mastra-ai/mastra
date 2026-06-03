---
'@mastra/react': minor
---

Added a `MessageFactory` component to `@mastra/react` for rendering a `MastraDBMessage` with your own per-part-type components.

Provide optional, fully type-safe render functions for each kind of message part. Only the renderer matching a part's type runs, and each receives correctly narrowed props. Missing renderers fall back gracefully. Runtime-only `dynamic-tool` and AI SDK v5 `tool-${string}` parts are covered by a dedicated `DynamicTool` renderer, and optional role wrappers let you frame parts per message role.

```tsx
import { MessageFactory } from '@mastra/react';

<MessageFactory
  message={message}
  Text={part => <p>{part.text}</p>}
  ToolInvocation={part => <ToolCard name={part.toolInvocation.toolName} />}
  DynamicTool={part => <ToolCard name={part.toolName} state={part.state} />}
  Data={part => <DataView type={part.type} data={part.data} />}
  roles={{ Signal: ({ children }) => <SignalFrame>{children}</SignalFrame> }}
/>;
```
