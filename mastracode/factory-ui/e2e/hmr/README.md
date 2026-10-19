From the repository root:

```sh
pnpm build:playground-ui
pnpm --filter @internal/factory-ui exec playwright install chromium
pnpm --filter @internal/factory-ui test:hmr
```

The suite edits temporary shared components, runs the full library watch build,
and checks rendered updates, generated CSS, and retained state through each app's
own Vite configuration. No API server is needed. Run it in an idle checkout:
it writes the library's `dist` and must not overlap another build or dev server.
