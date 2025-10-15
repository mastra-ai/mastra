## @mastra/ai-sdk
- Update README to include more usage examples ([#8817](https://github.com/mastra-ai/mastra/pull/8817))

## @mastra/core
- Ability to call agents as tools with .generate()/.stream() ([#8863](https://github.com/mastra-ai/mastra/pull/8863))

## @mastra/playground-ui
- Add @mastra/react to peer deps ([#8857](https://github.com/mastra-ai/mastra/pull/8857))

## @mastra/react
- Add @mastra/react to peer deps ([#8857](https://github.com/mastra-ai/mastra/pull/8857))

## mastra
- - Remove the `mastra deploy` CLI command. Use the deploy instructions of your individual platform.
- Remove `--env` flag from `mastra build` command
- Remove `--port` flag from `mastra dev`. Use `server.port` on the `new Mastra()` class instead.
- Validate `--components` and `--llm` flags for `mastra create` and `mastra init` ([#8798](https://github.com/mastra-ai/mastra/pull/8798))