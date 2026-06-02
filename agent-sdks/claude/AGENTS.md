Build from root: pnpm --filter ./agent-sdks/claude build:lib
Test from root: pnpm --filter ./agent-sdks/claude test

This package exposes `ClaudeSDKAgent`, a Mastra Agent wrapper around the Claude Agent SDK.

Keep vendor-specific SDK-agent helpers private to this package unless a helper is clearly useful as stable core API.
