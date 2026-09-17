---
'@mastra/playground-ui': minor
---

Added shared tool argument and output components so Studio and Factory use consistent edit previews, result styling, and full-value copying.

Before, output previews required separate display and copy values:

```tsx
<ToolCallMono copyText={result}>{result.length > 800 ? `${result.slice(0, 800)}…` : result}</ToolCallMono>
```

Now, use the shared components to render arguments or file edits and optionally limit output previews. Copying still includes the complete output:

```tsx
import { ToolCallArguments, ToolCallOutput } from '@mastra/playground-ui/components/ai/tool-call';

<ToolCallArguments toolName="view" args={{ path: 'src/agent.ts' }} />;
<ToolCallOutput text={result} maxLength={800} />;
```
