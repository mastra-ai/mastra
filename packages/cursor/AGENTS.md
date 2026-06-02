Build from root: pnpm --filter ./packages/cursor build:lib
Test from root: pnpm --filter ./packages/cursor test

This package exposes `CursorSDKAgent`, a Mastra Agent wrapper around the Cursor SDK.

Keep vendor-specific SDK-agent helpers private to this package unless a helper is clearly useful as stable core API.
