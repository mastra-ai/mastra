# Mastra Agent Examples

This directory contains example agents demonstrating various Mastra features.

## Getting Started

1. From the `mastra` repository root, change into this example directory and install dependencies:

   ```bash
   cd examples/agent
   pnpm install --ignore-workspace
   ```

2. Set up environment variables:

   ```bash
   cp .env.example .env
   # Edit .env with your API keys
   ```

3. Run the example:
   ```bash
   pnpm start
   ```

## Available Scripts

- `pnpm start` - Run the agent examples
- `pnpm mastra:dev` - Start Mastra development server
- `pnpm mastra:studio` - Open Mastra Studio UI
- `pnpm mastra:build` - Build for production
- `pnpm mastra:start` - Start production server

## Request Context Presets

This example includes a demonstration of Mastra's **Request Context Presets** feature, which allows you to define named configurations that can be easily switched between in the Studio UI.

### What are Request Context Presets?

Request context presets are predefined JSON configurations that can be selected from a dropdown in the Mastra Studio Playground. This feature enables you to quickly switch between different environments, user roles, or scenarios without manually editing JSON each time.

### Using Request Context Presets

#### 1. Running with Presets in Dev Mode

```bash
mastra dev --request-context-presets ./request-context-presets.json
```

#### 2. Running with Presets in Studio Mode

```bash
mastra studio --request-context-presets ./request-context-presets.json
```

#### 3. Using the Presets Dropdown

Once you start Mastra with the `--request-context-presets` flag:

1. Open the Mastra Studio in your browser
2. Navigate to an agent's page
3. Look for the **Request Context** section
4. You'll see a dropdown with available presets
5. Select a preset to automatically populate the JSON editor with that configuration
6. Click "Save" to apply the context to your agent interactions

The dropdown includes a "Custom" option that is automatically selected when you manually edit the JSON.

### Available Presets in This Example

This example includes the following presets in `request-context-presets.json`:

#### Environment Presets

- **development**: Development environment with debug logging
  - API endpoint: `https://dev-api.example.com`
  - Debug mode: enabled
  - Log level: debug

- **production**: Production environment with minimal logging
  - API endpoint: `https://api.example.com`
  - Debug mode: disabled
  - Log level: error

- **staging**: Staging environment for testing
  - API endpoint: `https://staging-api.example.com`
  - Debug mode: enabled
  - Log level: info

#### Role-Based Presets

- **admin-user**: Full administrative access
  - Permissions: read, write, delete, manage
  - Advanced tools: enabled
  - Analytics: enabled

- **guest-user**: Limited read-only access
  - Permissions: read only
  - Advanced tools: disabled
  - Analytics: disabled

### Request Context Demo Agent

The `requestContextDemoAgent` demonstrates how agents can dynamically adapt their behavior based on the request context:

#### Dynamic Agent Behavior

- **Instructions**: Vary by environment and role
  - Development mode includes verbose debugging instructions
  - Production mode provides optimized, concise guidance
  - Log level affects response detail

- **Model Selection**: Automatically chooses appropriate model
  - Production: `gpt-5` (higher quality)
  - Development/Staging: `gpt-5-mini` (faster iteration)

- **Tool Availability**: Conditionally provides tools based on permissions
  - `apiRequestTool`: Available to all users, uses environment-specific endpoints
  - `adminActionTool`: Only available with "manage" permission
  - `analyticsTool`: Only available when `features.analytics` is enabled

#### Testing Different Presets

Try switching between presets to see how the agent behaves differently:

1. Select the **development** preset and ask: "Make an API request to fetch user data"
   - Agent will use the dev API endpoint with debug logging

2. Select the **admin-user** preset and ask: "Show me analytics for the platform"
   - Agent will have access to analytics tools

3. Select the **guest-user** preset and ask the same question
   - Agent will explain it doesn't have permission for analytics

### Creating Your Own Presets File

You can create custom presets for your own use cases:

```json
{
  "preset-name": {
    "customField": "value",
    "nested": {
      "data": "example"
    }
  },
  "another-preset": {
    "userId": "user-123",
    "tenant": "acme-corp"
  }
}
```

Requirements:

- The file must contain a valid JSON object
- Each preset must be an object (not a string, number, or array)
- Preset values can contain any valid JSON structure

### Benefits

- **Faster Testing**: Switch between configurations instantly
- **Consistency**: Ensure the same configuration is used across team members
- **Documentation**: Preset names serve as documentation of supported scenarios
- **No Manual Editing**: Reduce errors from typing JSON manually
- **Environment Parity**: Test production configurations in development

## Stored Workflow Demo — `daily-standup-digest`

This example seeds a workflow at boot from a JSON `WorkflowDefinition`, without ever calling `createWorkflow(...)`. The workflow shows up in Studio like any other workflow because `mastra.addStoredWorkflow(...)` persists it to `WorkflowDefinitionsStorage` and live-registers it in one shot.

### What it demonstrates

- Declarative `tool` / `agent` / `mapping` / `foreach` / `conditional` / `workflow` entry types round-tripping from JSON.
- The three-scope template model: `${initData.teamName}` and `${stepResults.normalize-each-note}` in a `mapping` step, with the array of per-note outputs JSON-encoded automatically.
- `foreach(agent)` with `concurrency`, rehydrated from JSON.
- A `conditional` step with declarative predicates that picks between two nested **stored** sub-workflows (`daily-standup-plain` when there are no blockers, `daily-standup-with-escalation` when there are). The `conditional`'s output is `{ markdown: string }` regardless of branch, which becomes the parent workflow's terminal output.
- Nested stored workflows as a first-class step type — the parent JSON references sub-workflows by id, they live in their own JSON files, and each can be inspected, run, or edited independently in Studio.
- Restart survival: kill `pnpm mastra dev`, restart, and all three workflows are still there because `LibSQLStore`'s `workflowDefinitions` domain persists them.

### Files

- `src/mastra/stored-workflows/daily-standup-digest.json` — the top-level `WorkflowDefinition` (normalize → detect blockers → conditional → nested sub-workflow).
- `src/mastra/stored-workflows/daily-standup-plain.json` — sub-workflow used when there are no blockers.
- `src/mastra/stored-workflows/daily-standup-with-escalation.json` — sub-workflow used when there are blockers; also drafts a tech-lead escalation message.
- `src/mastra/stored-workflows/daily-standup-agents.ts` — the three agents referenced by `agentId`.
- `src/mastra/stored-workflows/daily-standup-tools.ts` — the four tools referenced by `toolId`.
- `src/mastra/index.ts` — imports the JSON files and seeds all three via `mastra.addStoredWorkflow(...)` after the `Mastra` instance is constructed. The two sub-workflows are seeded before the parent so `collectRefs` can resolve their ids.

### Try it

```bash
pnpm mastra dev
```

Then in Studio:

1. Open **Workflows** → `daily-standup-digest`.
2. Run with an input that has at least one real blocker to hit the escalation branch:
   ```json
   {
     "teamName": "Platform",
     "notes": [
       { "author": "Alex", "text": "yesterday shipped the auth fix. today wiring up the retry queue. blocked on staging creds." },
       { "author": "Sam",  "text": "finished the migration script. moving on to the dashboard rewrite. no blockers." }
     ]
   }
   ```
3. Or run with all-clear notes to hit the plain-digest branch:
   ```json
   {
     "teamName": "Platform",
     "notes": [
       { "author": "Alex", "text": "shipped auth fix. today: retry queue. no blockers." },
       { "author": "Sam",  "text": "migration done. today: dashboard rewrite. no blockers." }
     ]
   }
   ```
4. Confirm the run produces a `markdown` output with a dated `# Platform — Daily Standup (...)` header. The blocker input additionally includes a `## Escalation` section drafted by the `standup-escalation` agent.

### Proof of restart survival

1. Run `pnpm mastra dev` once so the workflow is upserted into `mastra.db`.
2. Stop the process.
3. Delete `src/mastra/stored-workflows/daily-standup-digest.json` (temporarily).
4. Restart `pnpm mastra dev` — the workflow still appears in Studio because it was loaded from storage on boot, not from the JSON file.
5. Restore the JSON file when done.

## Learn More

- [Mastra Documentation](https://mastra.ai/docs)
- [Request Context Guide](https://mastra.ai/docs/core-concepts/request-context)
