---
'@mastra/playground-ui': minor
---

Added reusable compound tool primitives with the humanized labels, compact rows, generic Tools icon, command output, file writes, and diffs used by MastraCode Factory. Generic tools now present labeled input and output together in a card, with JSON syntax highlighting when parsing succeeds and a plain-text fallback otherwise. Applications can compose custom headers, entity-colored icons, actions, expandable content, and transcript-aligned connected tool sequences without routing that content through the generic renderer.

```tsx
import {
  Tool,
  ToolCallListItem,
  ToolContent,
  ToolHeader,
  ToolIcon,
} from '@mastra/playground-ui/components/ai/tool-call';
import { WorkflowIcon } from '@mastra/playground-ui/icons/WorkflowIcon';

<ToolCallListItem continued>
  <Tool status="success">
    <ToolHeader>
      <ToolIcon>
        <WorkflowIcon className="text-accent3" />
      </ToolIcon>
      Order workflow
    </ToolHeader>
    <ToolContent>{workflowGraph}</ToolContent>
  </Tool>
</ToolCallListItem>;
```
