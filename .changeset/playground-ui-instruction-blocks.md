---
'@mastra/playground-ui': minor
---

Added the instruction block editor (`AgentCMSBlocks`, prompt block picker, saved-block references and `DisplayConditionsDialog`) under `@mastra/playground-ui/domains/instruction-blocks`, so apps other than Studio can let users compose agent instructions from text and saved prompt blocks.

The editor loads and saves prompt blocks through the `@mastra/react` hooks, so render it inside `MastraReactProvider` and a React Query `QueryClientProvider`:

```tsx
import { MastraReactProvider } from '@mastra/react';
import {
  AgentCMSBlocks,
  createInstructionBlock,
  type InstructionBlock,
} from '@mastra/playground-ui/domains/instruction-blocks';

function InstructionsEditor() {
  const [blocks, setBlocks] = useState<InstructionBlock[]>([createInstructionBlock('You are a helpful agent.')]);
  return <AgentCMSBlocks items={blocks} onChange={setBlocks} />;
}

<MastraReactProvider baseUrl="https://my-mastra-server">
  <InstructionsEditor />
</MastraReactProvider>;
```
