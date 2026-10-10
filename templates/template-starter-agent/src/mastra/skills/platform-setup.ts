import { createSkill } from '@mastra/core/skills';

export const platformSetupSkill = createSkill({
  name: 'platform-setup',
  description:
    'Help someone chatting with this deployed agent in Studio get set up with its tools, channels, and the Mastra platform. Use when they ask what is already set up, how to connect services or chat channels, where to find project settings, or what to do next for their goal.',
  instructions: `The user is talking to you in the hosted Studio of a deployed project, usually right after onboarding. They work in the browser: the Mastra platform and this Studio. Don't assume they have the code, a terminal, or the CLI.

<workflow>
1. Call \`list_connections\` to check the current project context, catalog, project connections, available tools, and this agent's channel installations. Distinguish what is configured from what is ready. A project link or server URL does not prove a deployment is live.
2. Start with the user's goal. Summarize only the setup that matters and suggest one useful next step. Use existing tools when they already meet the goal. If the goal is unclear, ask one short question instead of listing the whole catalog.
3. Explain where to go using the returned links: the project overview for project context, the project Connections page for integrations, and Studio's Config → Channels for this agent's channel installations. Do not invent links or identifiers.
4. If a connection is needed, explain what it enables in one sentence grounded in runtime metadata, tool descriptions, or catalog-linked docs. State its auth type, required fields, and prerequisites from those sources. Send them to the project Connections link to connect it there. Only if they say they work from a terminal, mention \`mastra connect add <catalog-id> --project <project-id>\`. Credentials belong in the Platform form, never chat.
5. Distinguish tools that act on a service from channels where the user messages the agent. For channels, connect the provider first, then finish the agent installation in Config → Channels. Channel callbacks need a public server URL. Use catalog-linked docs for vendor setup and messaging instructions; do not supply remembered provider-specific steps.
6. After the user connects or installs, call \`list_connections\` with \`refresh: true\`. Confirm discovered tool names or an active agent installation. New tools become available on the next message without a restart. If something is incomplete, state the observed status and the next step. Do not send messages or change external data to test it without permission.
</workflow>

<constraints>
You MUST use runtime metadata and catalog documentation links for provider-specific guidance, not a fixed provider list. Do not recommend coming-soon entries or capabilities this starter cannot use. If metadata or docs omit a prerequisite, point to the catalog's documentation link; if none exists, say the setup guidance is unavailable rather than guessing.
Keep missing configuration, failed lookups, and empty results distinct. Report what could not be checked. Keep replies short and practical, with no marketing or emoji.
</constraints>
`,
});
