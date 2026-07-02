# Mastra Code scripts

## Render Smoke

Render Smoke is a local OpenAI-compatible streaming mock used to stress-test Mastra Code TUI rendering with large streamed tool arguments.

Install the provider and model pack into global Mastra Code settings:

```sh
pnpm --filter mastracode render-smoke:install
```

The installer is idempotent and nondestructive:

- adds/updates the `Render Smoke` custom provider
- adds/updates the `Render Smoke` custom model pack
- preserves the current active model pack and mode defaults
- writes a timestamped backup before changing an existing settings file

Start the mock server:

```sh
pnpm --filter mastracode render-smoke:server
```

Default endpoint:

```txt
http://localhost:8787/v1
```

Useful environment overrides:

```sh
PORT=8787 LARGE_SIZE=60000 CHUNK_SIZE=48 DELAY_MS=25 pnpm --filter mastracode render-smoke:server
```

Prompts to send from Mastra Code after selecting the Render Smoke pack:

```txt
write a large file
edit a large file
run command output
```

Routes:

- `write` streams a large `write_file` call with `.ts` content.
- `edit` streams a large `string_replace_lsp` call with `.ts` `old_string` and `new_string` args.
- `command` / `output` streams a large `execute_command.command` argument.
