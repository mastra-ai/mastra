# Updating Your MCP Configuration

Now, let's update your MCP configuration in `src/mastra/agents/index.ts` to include the Filesystem server:

```typescript
import { isAbsolute } from 'node:path'

const notesDir = process.env.NOTES_DIR

if (!notesDir || !isAbsolute(notesDir)) {
  throw new Error('Set NOTES_DIR to the absolute path of your notes directory')
}

const mcp = new MCPClient({
  servers: {
    zapier: {
      url: new URL(process.env.ZAPIER_MCP_URL || ''),
      requestInit: {
        headers: {
          Authorization: `Bearer ${process.env.ZAPIER_MCP_API_KEY}`,
        },
      },
    },
    github: {
      url: new URL('https://api.githubcopilot.com/mcp/'),
      requestInit: {
        headers: {
          Authorization: `Bearer ${process.env.GITHUB_PERSONAL_ACCESS_TOKEN}`,
        },
      },
    },
    hackernews: {
      command: 'npx',
      args: ['-y', '@devabdultech/hn-mcp-server'],
    },
    textEditor: {
      command: 'pnpx',
      args: [`@modelcontextprotocol/server-filesystem`, notesDir],
    },
  },
})
```

This configuration tells MCP to run the Filesystem server using PNPX, pointing it to the "notes" directory we created. The server receives `notesDir`, which is the absolute path from `NOTES_DIR`, so it resolves to the same folder no matter which working directory Mastra starts the app from.

The `textEditor` key is a unique identifier for this server in your configuration. The `command` property specifies that we want to use PNPX to run the server, and the `args` property provides the arguments to pass to PNPX, including the package name and the absolute path to the notes directory.
