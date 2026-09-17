---
'@mastra/react': major
'@mastra/playground-ui': patch
---

Removed the UI components and their types from the root `@mastra/react` entrypoint. Import them from `@mastra/react/ui` instead.

**Why**

The root entrypoint re-exported everything from `./ui`, which pulled `shiki`, `@radix-ui/react-tooltip`, `lucide-react` and `react-dom` into every consumer, even those only using the headless hooks. This made `@mastra/react` unusable in React Native / Expo (see https://github.com/mastra-ai/mastra/issues/20964) and inflated bundles for web apps that do not render Mastra UI. The root entrypoint now only contains hooks, the provider and the client helpers.

**Before**

```ts
import { MessageFactory, useChat } from '@mastra/react';
import type { MessageFactoryPart, ToolInvocationPart } from '@mastra/react';
```

**After**

```ts
import { useChat } from '@mastra/react';
import { MessageFactory } from '@mastra/react/ui';
import type { MessageFactoryPart, ToolInvocationPart } from '@mastra/react/ui';
```

Affected exports: `Entity`, `Code`, `Icon`, `IconButton`, `Icons`, `Tooltip`, `Message`, `MessageFactory` and all their associated types (`MessageRenderers`, `MessageStatusRenderers`, `TextPart`, `ReasoningPart`, `FilePart`, `ToolInvocationPart`, `DynamicToolPart`, `DataPart`, `MessageFactoryPart`, …).
