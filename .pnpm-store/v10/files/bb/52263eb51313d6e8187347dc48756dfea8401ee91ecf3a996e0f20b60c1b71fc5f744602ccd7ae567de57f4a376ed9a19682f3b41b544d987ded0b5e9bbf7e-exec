#!/usr/bin/env node

import meow from 'meow'
import './eventsource-polyfill.js'
import { runWithCommand, runWithConfig, runWithConfigNonInteractive, runWithSSE, runWithURL } from './mcp.js'
import { purge } from './config.js'

const cli = meow(
  `
	Usage
    $ mcp-cli
    $ mcp-cli --config [config.json]
    $ mcp-cli [--pass-env] npx <package-name> <args>
    $ mcp-cli [--pass-env] node path/to/server/index.js args...
    $ mcp-cli --url http://localhost:8000/mcp
    $ mcp-cli --sse http://localhost:8000/sse
    $ mcp-cli purge
    $ mcp-cli [--config config.json] call-tool <server_name>:<tool_name> [--args '{"key":"value"}']
    $ mcp-cli [--config config.json] read-resource <server_name>:<resource_uri>
    $ mcp-cli [--config config.json] get-prompt <server_name>:<prompt_name> [--args '{"key":"value"}']

	Options
	  --config, -c    Path to the config file
    --pass-env, -e  Pass environment variables in current shell to stdio server
    --url           Streamable HTTP endpoint
    --sse           SSE endpoint
    --args          JSON arguments for tools and prompts (non-interactive mode)
`,
  {
    importMeta: import.meta,
    flags: {
      config: {
        type: 'string',
        shortFlag: 'c',
      },
      passEnv: {
        type: 'boolean',
        shortFlag: 'e',
      },
      args: {
        type: 'string',
      },
    },
  },
)

if (cli.input[0] === 'purge') {
  purge()
} else if (
  cli.input.length >= 2 &&
  (cli.input[0] === 'call-tool' || cli.input[0] === 'read-resource' || cli.input[0] === 'get-prompt')
) {
  // Non-interactive mode: mcp-cli [--config config.json] <command> <server-name>:<target> [--args '{}']
  const [command, serverTarget] = cli.input
  const [serverName, target] = serverTarget.split(':')
  await runWithConfigNonInteractive(cli.flags.config, serverName, command, target, cli.flags.args)
} else if (cli.input.length > 0) {
  const [command, ...args] = cli.input
  await runWithCommand(command, args, cli.flags.passEnv ? process.env : undefined)
} else if (cli.flags.url) {
  await runWithURL(cli.flags.url)
} else if (cli.flags.sse) {
  await runWithSSE(cli.flags.sse)
} else {
  await runWithConfig(cli.flags.config)
}
