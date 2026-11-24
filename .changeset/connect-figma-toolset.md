---
'@mastra/connect': minor
---

Added a Figma toolset with 29 tools. Agents can read files, nodes, versions, and the components, component sets, and styles a file or team publishes; render nodes as images; post, react to, and delete comments; link nodes to dev resources; and read and update variables (variables need a Figma Enterprise organization).

Connect a Figma account to your project first (`mastra connect add figma`). When running locally, set `MASTRA_PLATFORM_ACCESS_TOKEN` and `MASTRA_PROJECT_ID` in the app's environment so `tools()` can find the connection. Then add the tools to an agent:

```ts
import { Agent } from '@mastra/core/agent';
import { tools } from '@mastra/connect';

const designAgent = new Agent({
  id: 'design-agent',
  name: 'Design agent',
  instructions: 'Use the connected Figma tools to review designs and answer questions about them.',
  model: 'openai/gpt-6.1-sol',
  tools: tools({ providers: ['figma'] }),
});
```

Node ids work in either form: `91:1`, or the `91-1` form from a Figma URL's `node-id` parameter. Figma's API has no team-wide file or project listing for public apps, so give the agent a file key (from the file's URL); the team library tools take a team id.
