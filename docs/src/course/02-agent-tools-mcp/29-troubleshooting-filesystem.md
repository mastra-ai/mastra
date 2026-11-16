# Troubleshooting

If your agent can't access the Filesystem tools, check:

1. That you have PNPX installed and working properly
2. That the "notes" directory exists in the correct location
3. That the tools are properly loaded by checking the Tools tab in the playground

Common issues include:

- PNPX not being installed or configured properly
- The notes directory not existing or having incorrect permissions
- Path issues in the MCP configuration

If you're having trouble, try running the PNPX command manually in your terminal to see if it works:

```bash
export NOTES_DIR="$(pwd)/notes"
pnpx @modelcontextprotocol/server-filesystem "$NOTES_DIR"
```

This can help identify whether the issue is with PNPX itself or with how it's being used in your Mastra configuration. Make sure `NOTES_DIR` is set to the absolute path of the `notes` directory — a relative path resolves against the working directory Mastra starts the app from (`src/mastra/public` under `mastra dev`), not your project root.
