Build from root: pnpm --filter ./packages/claude build:lib
Test from root: pnpm --filter ./packages/claude test

This package exposes `ClaudeSDKAgent`, a Mastra Agent wrapper around the Claude Agent SDK.

Keep vendor-specific SDK-agent helpers private to this package unless a helper is clearly useful as stable core API.
