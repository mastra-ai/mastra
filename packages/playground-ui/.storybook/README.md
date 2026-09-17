# Chat composition stories

Run `pnpm --filter @mastra/playground-ui storybook` for the shared components and the application compositions in one catalog. `pnpm --filter @mastra/playground-ui typecheck:storybook` checks those compositions together.

`src/ds/components` contains the published UI: composer surfaces and actions, model menu parts, segmented comboboxes, settings fields, and warning containers. These components receive values, content, and callbacks. They do not fetch catalogs, choose a provider, apply a model pack, persist settings, or start a voice call.

Studio compositions live in `packages/playground/.storybook`; Factory compositions live in `mastracode/factory-ui/.storybook`. They import their own production presentation and the shared UI. Studio owns voice, dictation, execution methods, approval settings, and policy messages. Factory owns mode icons and pack actions. The Storybook resolver points public Playground UI imports at source so app compositions and shared primitives use the same contexts.

Fixtures use a small catalog and local state to exercise visual states. Their callbacks are demonstrations, not production transport or persistence tests. Production behavior is covered separately by each application's MSW suites. Keep draft simulations and preset selectors in Storybook fixtures; they are not a shared chat controller.
