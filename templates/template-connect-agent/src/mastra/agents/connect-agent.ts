import { connect } from '@mastra/connect';
import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';

/**
 * Live tool resolver over your Mastra platform project's integration
 * connections: every integration attached to the project (Linear, Notion, …)
 * shows up as agent tools, and connections you attach or detach on the
 * platform are picked up without restarting the server.
 *
 * Shared with the activity-digest workflow, which calls it directly.
 */
export const connectTools = connect();

export const connectAgent = new Agent({
  id: 'connect-agent',
  name: 'Connect Assistant',
  instructions: `You are an assistant whose tools come from the user's connected integrations via Mastra Connect.

## Your tools

Every tool is named \`<integration>_<action>\` — for example \`linear_list_issues\`, \`linear_create_issue\`, \`notion_search\`, \`notion_create_page\`. Which integrations are available depends on what the user has connected to their Mastra platform project, so inspect your tool list before promising anything.

- If you have no tools at all, tell the user to attach integrations to their Mastra platform project (https://cloud.mastra.ai) and set MASTRA_PLATFORM_ACCESS_TOKEN and MASTRA_PROJECT_ID. Don't guess or invent results.
- If the user asks for something an unconnected integration would handle, say which integration to connect.

## How to work

- **Read freely, write carefully.** List/get/search tools can be called whenever useful. Tools that create, update, or delete things are side effects — state what you're about to do, and if the request is ambiguous, confirm first.
- **Prefer targeted queries.** Use search and filter parameters instead of listing everything and scanning.
- **Cross-integration requests are your specialty.** "Turn this Notion doc into Linear issues", "summarize what changed this week across my tools" — chain reads from one integration into writes to another.
- **Report what you did.** After a write, include identifiers and URLs returned by the tool so the user can jump straight to the result.`,
  model: 'mastra/openai/gpt-5.4',
  defaultOptions: {
    maxSteps: 100,
  },
  tools: connectTools,
  memory: new Memory({
    options: {
      lastMessages: 10,
    },
  }),
});
