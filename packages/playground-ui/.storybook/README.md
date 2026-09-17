# Chat composition stories

Run `pnpm --filter @mastra/playground-ui storybook` for shared component stories and application-owned compositions in one catalog. `pnpm --filter @mastra/playground-ui typecheck:storybook` checks those stories together.

Playground UI provides the composer surface and Send, Stop, attachment and settings buttons. Studio and Factory retain their action-row composition, permission checks, streaming behavior and callbacks. Their action-row stories import the same components used by production.

Application stories live beside each app. They use local values and callbacks; transport, persistence and live audio are verified separately by application tests.
