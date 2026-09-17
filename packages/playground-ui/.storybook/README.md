# Shared component stories

Run `pnpm --filter @mastra/playground-ui storybook` to explore Playground UI components and their composition. Stories import only this package's UI. Application-specific layouts, permission checks, voice controls, settings and persistence stay in Studio and Factory.

`pnpm --filter @mastra/playground-ui typecheck:storybook` checks the local stories, fixtures and Storybook configuration. Its tsconfig extends the package configuration without cross-application paths or aliases.

Composer action stories cover the shared round and outline buttons, disabled states and send/stop composition. Applications supply their own callbacks and decide when each action is available.

Model picker stories demonstrate combined menus, provider/model segments, model packs, loading, locked, unavailable and warning states using shared primitives and local catalogs. Provider discovery, credentials, policy, pack resolution and persisted selections stay in the applications.
