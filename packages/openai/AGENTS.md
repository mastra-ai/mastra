Build from root: pnpm --filter ./packages/openai build:lib
Test from root: pnpm --filter ./packages/openai test

This package exposes `OpenAISDKAgent`, a Mastra Agent wrapper around the OpenAI Agents SDK.

Keep vendor-specific SDK-agent helpers private to this package unless a helper is clearly useful as stable core API.
