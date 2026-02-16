# Create Mastra Reference

Complete guide for creating new Mastra projects. Includes both quickstart CLI method and detailed manual installation.

**Official documentation: [mastra.ai/docs](https://mastra.ai/docs)**

## Getting Started

Ask: **"How would you like to create your Mastra project?"**

1. **Quick Setup**: Copy and run: `npm create mastra@latest`
2. **Guided Setup**: I walk you through each step, you approve commands
3. **Automatic Setup**: I create everything, just give me your API key

> **For AI agents:** The CLI is interactive. Use **Automatic Setup** to create files using the steps in "Automatic Setup / Manual Installation" below.

## Prerequisites

- An API key from a supported model provider (OpenAI, Anthropic, Google, etc.)

## Quick Setup (user runs CLI)

Create a new Mastra project with one command:

```bash
npm create mastra@latest
```

**Other package managers:**

```bash
pnpm create mastra@latest
yarn create mastra@latest
bun create mastra@latest
```

## CLI flags

**Skip the example agent:**

```bash
npm create mastra@latest --no-example
```

**Use a specific template:**

```bash
npm create mastra@latest --template <template-name>
```

## Automatic setup / manual installation

**Use this for automatic setup** (AI creates all files) or when you prefer manual control.

Follow these steps to create a complete Mastra project:

### Step 1: Create project directory

```bash
mkdir my-first-agent && cd my-first-agent
npm init -y
```

### Step 2: Install dependencies

```bash
npm install -D typescript @types/node mastra@latest
npm install @mastra/core@latest zod@^4
```

### Step 3: Configure package scripts

Add to `package.json`:

```json
{
  "scripts": {
    "dev": "mastra dev",
    "build": "mastra build"
  }
}
```

### Step 4: Configure TypeScript

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true,
    "outDir": "dist"
  },
  "include": ["src/**/*"]
}
```

**Important:** Mastra requires `"module": "ES2022"` and `"moduleResolution": "bundler"`. CommonJS will cause errors.

### Step 5: Create environment file

Create `.env` with your API key:

```env
GOOGLE_GENERATIVE_AI_API_KEY=<your-api-key>
```

Or use `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, etc.

### Step 6: Create weather tool

Create `src/mastra/tools/weather-tool.ts`:

```typescript
import { createTool } from "@mastra/core/tools";
import { z } from "zod";

export const weatherTool = createTool({
  id: "get-weather",
  description: "Get current weather for a location",
  inputSchema: z.object({
    location: z.string().describe("City name"),
  }),
  outputSchema: z.object({
    output: z.string(),
  }),
  execute: async () => {
    return { output: "The weather is sunny" };
  },
});
```

### Step 7: Create weather agent

Create `src/mastra/agents/weather-agent.ts`:

```typescript
import { Agent } from "@mastra/core/agent";
import { weatherTool } from "../tools/weather-tool";

export const weatherAgent = new Agent({
  id: "weather-agent",
  name: "Weather Agent",
  instructions: `
      You are a helpful weather assistant that provides accurate weather information.

      Your primary function is to help users get weather details for specific locations. When responding:
      - Always ask for a location if none is provided
      - If the location name isn't in English, please translate it
      - If giving a location with multiple parts (e.g. "New York, NY"), use the most relevant part (e.g. "New York")
      - Include relevant details like humidity, wind conditions, and precipitation
      - Keep responses concise but informative

      Use the weatherTool to fetch current weather data.
`,
  model: "google/gemini-2.5-pro",
  tools: { weatherTool },
});
```

**Note:** Model format is `"provider/model-name"`. Examples:

- `"google/gemini-2.5-pro"`
- `"openai/gpt-4o"`
- `"anthropic/claude-3-5-sonnet-20241022"`

### Step 8: Create mastra entry point

Create `src/mastra/index.ts`:

```typescript
import { Mastra } from "@mastra/core";
import { weatherAgent } from "./agents/weather-agent";

export const mastra = new Mastra({
  agents: { weatherAgent },
});
```

### Step 9: Launch development server

```bash
npm run dev
```

Access Studio at `http://localhost:4111` to test your agent.

## Next steps

After creating your project with `create mastra`:

- **Customize the example agent** in `src/mastra/agents/weather-agent.ts`
- **Add new agents** - see [Agents documentation](https://mastra.ai/docs/agents/overview)
- **Create workflows** - see [Workflows documentation](https://mastra.ai/docs/workflows/overview)
- **Add more tools** to extend agent capabilities
- **Integrate into your app** - see framework guides at [mastra.ai/docs](https://mastra.ai/docs)

## Troubleshooting

| Issue              | Solution                                                                             |
| ------------------ | ------------------------------------------------------------------------------------ |
| API key not found  | Make sure your `.env` file has the correct key                                       |
| Studio won't start | Check that port 4111 is available                                                    |
| CommonJS errors    | Ensure `tsconfig.json` uses `"module": "ES2022"` and `"moduleResolution": "bundler"` |
| Command not found  | Ensure you're using Node.js 20+                                                      |

## Resources

- [Docs](https://mastra.ai/docs)
- [Installation](https://mastra.ai/docs/getting-started/installation)
- [Agents](https://mastra.ai/docs/agents/overview)
- [Workflows](https://mastra.ai/docs/workflows/overview)
- [GitHub](https://github.com/mastra-ai/mastra)
