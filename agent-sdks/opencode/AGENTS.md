Build from root: pnpm --filter ./agent-sdks/opencode build:lib
Test from root: pnpm --filter ./agent-sdks/opencode test

This package exposes a Mastra integration for the OpenCode SDK.

Keep OpenCode-specific SDK helpers private to this package unless a helper is clearly useful as stable core API.
