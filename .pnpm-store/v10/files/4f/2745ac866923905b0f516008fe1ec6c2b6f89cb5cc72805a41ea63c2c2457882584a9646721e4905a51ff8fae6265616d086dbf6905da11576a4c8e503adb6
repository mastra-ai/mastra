# mcp-cli

A CLI inspector for the Model Context Protocol

https://github.com/user-attachments/assets/4cd113e9-f097-4c9d-b391-045c5f213183

## Features

- Run MCP servers from various sources
- List Tools, Resources, Prompts
- Call Tools, Read Resources, Read Prompts
- OAuth support for SSE and Streamable HTTP servers

## Usage

### Run without arguments

```bash
npx @wong2/mcp-cli
```

This will use the config file of Claude Desktop.

### Run with a config file

```bash
npx @wong2/mcp-cli -c config.json
```

The config file has the same format as the Claude Desktop config file.

### Run servers from NPM

```bash
npx @wong2/mcp-cli npx <package-name> <args>
```

### Run locally developed server

```bash
npx @wong2/mcp-cli node path/to/server/index.js args...
```

### Connect to a running server over Streamable HTTP

```bash
npx @wong2/mcp-cli --url http://localhost:8000/mcp
```

### Connect to a running server over SSE

```bash
npx @wong2/mcp-cli --sse http://localhost:8000/sse
```

### Non-interactive mode

Run a specific tool, resource, or prompt without interactive prompts:

```bash
npx @wong2/mcp-cli [--config config.json] <command> <server-name>:<target> [--args '{}']
```

Examples:

```bash
# Call a tool without arguments
npx @wong2/mcp-cli -c config.json call-tool filesystem:list_files

# Call a tool with arguments
npx @wong2/mcp-cli -c config.json call-tool filesystem:read_file --args '{"path": "package.json"}'

# Read a resource
npx @wong2/mcp-cli -c config.json read-resource filesystem:file://system/etc/hosts

# Use a prompt
npx @wong2/mcp-cli -c config.json get-prompt filesystem:create_summary --args '{"text": "Hello world"}'
```

This mode is useful for scripting and automation, as it bypasses all interactive prompts and executes the specified primitive directly.

### Purge stored data (OAuth tokens, etc.)

```bash
npx @wong2/mcp-cli purge
```

## Related

- [mcpservers.org](https://mcpservers.org) - A curated list of MCP servers
