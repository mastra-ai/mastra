# Changelog

## Unreleased

- When running `npx convex deploy`, the CLI will now ask for explicit
  confirmation before deleting large indexes. This change is helpful for
  avoiding situations where an index is accidentally deleted and backfilling it
  takes a long time.

## 1.29.0

- Code generation changes: modules and functions are sorted in more situations,
  some unused imports have been removed, and some docstrings have been updated.
  Expect to need to commit a larger-than-usual change to generated files after
  upgrading to this version of Convex.

- Add .pick(), .omit(), .partial(), and .extend() methods to v.objects()
  validators. This makes reusing validator with small changes simpler. See
  https://docs.convex.dev/functions/validation#reusing-and-extending-validators
  for more.

- Add a pagination result validation helper
  `paginationResultValidator(itemValidator)` describing and validating the
  return value of a paginated query.

- New `npx convex codegen --component-dir ../path/to/component` flag for
  component authors to generate code only for a component.

- New `convex.json` configuration property `codegen.fileType` (`"dts/js"` or
  `"ts"`, default `"dts/js"`) Default for applications is still "dts/js" but for
  components generated files always use "ts" file extensions.

- New `convex.json` configuration property `codegen.legacyComponentApi` (default
  true) which can be set to false to opt into importing the API of a component
  directly from its package or directory instead of inlining the result of
  analyzing a component in parent component that uses it.

- Improved TypeScript inference performance for `ApiFromModules`, the workhorse
  type that transforms modules of Convex functions into a tree of
  `FunctionReference` types for the `api` object. Thanks to David Blass, the
  maintainer of ArkType, for working with us on these improvements.

## 1.28.2

- Bundling fix: don't double-deploy components in the convex/ directory.

## 1.28.1

- Add json schema to package.json.

## 1.28.0

- Deploy code path unification: all deploys now use a codepath that supports
  components, whether or not any components are used in the project. Generating
  the files in `convex/_generated/` now requires a deployment to be present and
  for all environment variables used in convex/auth.config.ts to be set.

  Scripts that call `npx convex codegen` are the most likely to be affected by
  this change, and `npx convex codgen` no longer works for any projects in
  preview deployments because preview deployments may not exist until the
  deploy.

  Committing generated code is recommended and this change makes this
  recommendation more important.

- WebSocket sync protocol support for TransitionChunk messages: just splitting a
  Transition (containing new query results) into multiple WebSocket messages in
  order prevent the server from appearing non-responsive.

## 1.27.5

- Export an `AuthConfig` type to describe the object exported from
  `convex/auth.config.ts`.

## 1.27.4

- Add a `getAuth()` method to the client which returns the current token and
  claims. This method is intended for instrumentation purposes like adding this
  information to a reported Sentry error or event.

- Change to CLI `--admin-key` and `--url` arg parsing logic to avoid coercing
  empty strings to booleans.

- Vendor jwt-decode along with a few other dependnecies; this brings the number
  of runtime dependencies for Convex from 3 to 2: esbuild (binary) and prettier.

- Fix ConvexProviderWithClerk to catch `getToken()` errors. This could cause
  changes in behavior of refreshing Clerk tokens, we'll be watching this one.

## 1.27.3

- Convex CLI now respects `HTTPS_PROXY` / `HTTP_PROXY` environment variables.
  This is generally useful but was motivated by making Convex run in remote
  asynchronous agent environemnts like Codex.
- Cutoffs for logging large and slow Transition messages have been lowered.

## 1.27.2

- `npx convex run` sends function log output to stderr instead of stdout.

- Increase the timeout when waiting for a local backend to start up from 10 to
  30 seconds.

- Capability to provision WorkOS environments when `WORKOS_CLIENT_ID`
  environment variable is missing.

## 1.27.1

- Changes to logged messages in the console, where previously only WebSocket
  reconnection messages were logged. These can still be silenced with the
  `logger: false` client option.
- Improved support for the TypeScript tsconfig.json compiler option
  "exactOptionalPropertTypes" with the convex package.
- Additional WebSocket connection debugging information about Transition
  messages.
- Clearer error messages when running codegen in preview deployments.
- Token limits for especially verbose logs MCP tool.
- Add (preexisting) `codegen` options to `convex.json` schema.

## 1.27.0

- Add support for configuring the Node.js version used by Node actions using the
  `node.nodeVersion` field of the `convex.json` file
  ([docs](https://docs.convex.dev/production/project-configuration#configuring-the-nodejs-version)).
- `npx convex data` now supports exporting data as JSON or JSONL with the
  `--format` option.
- `npx convex env set` now supports setting environment variables via piping
  (STDIN) (for example
  `cat keys/my-private-key.txt | npx convex env set JWT_PRIVATE_KEY`).

## 1.26.2

- Fix for pushing schemas to older (self-hosted) deployment builds.

## 1.26.0

- Add support for staged indexes. Instead of blocking on push, a staged index
  backfills while you push more changes to a deployment, then can be used once
  it is no longer marked as staged.

  ```
  export default defineSchema({
    messages: defineTable({
      author: v.string(),
      body: v.string(),
    })
      .index("by_author", {
        fields: ["author"],
         // watch for progress in dashboard. Once it's at 100%, remove the staged flag
        staged: true,
      })
  });
  ```

  Read more in the docs (link coming soon).

- Experimental `ConvexReactClient.prewarmQuery({query, args})` method for
  subscribing to a query for 5 seconds. Prewarming indicates likely future
  interest in a subscription and is currently implemented by subscribing to the
  query for 5 seconds.

  The return value of this method may change and the arguments may change in the
  future so this API should be considered unstable but adapting to these changes
  shouldn't be difficult.

- Expose the schemaValidation property of schema, intended for runtime tests or
  assertions that it is indeed enabled.

- Export TokenFetcher type, intended for external auth integrations.

- More informative messaging on code push. Link to index backfill progress in
  the dashboard.

- Fix a bug where an auth token passed initially to the ConvexHttpClient was
  ignored.

- Experimental `expectAuth` option for Convex clients for indicating that
  setAuth() will be called soon, so to wait for that token. Once setAuth() has
  been called the existing token-waiting behavior takes over.

  This is useful for applications that create a client and run a mutation,
  query, or action _before_ setAuth() has been called, e.g. via a provider in
  React.

- Change the default permissions for the local MCP server: access to production
  deployments is now disabled by default, requiring
  `--dangerously-enable-production-deployments` to enable.

- Add a "logs" tool to the local MCP server.

## 1.25.4

- Experimental `convex dev --once --debug-node-apis` debug flag for tracing
  through imports to find Node.js APIs imported from non-"use node" convex
  endpoint files.

- Experimental `CONVEX_AGENT_MODE=anonymous npx convex dev` for a
  non-interactive anonymous development flow when not logged in.

- Simplify the `Logger` interface of Convex clients making it easier to replace.

- Reactive `ConnectionState` via `useConvexConnectionState` hook. How often this
  value updates may change in the future if more information is added to
  `ConnectionState`.

- Escape JavaScript keywords in codegen, fixing issues with files in the convex
  folder named things like convex/delete.ts.

- Warn when the explicit value `undefined` is passed to Next.js server-side
  helpers, indicating the issue may have been an unset environment variable.
  This may become an error in the future.

- Error closer to the call site when invalid validators are contructed.

## 1.25.2

- Increase a network timeout that was causing Node.js v20+ issues on slow
  connections, good old Happy Eyeballs
  https://github.com/nodejs/node/issues/54359.

## 1.25.1

- Print more error info in `npx convex network-test`.

- Crash when it looks like an environment variable is missing:
  `CONVEX_DEPLOY_KEY=project:me:new-project|eyABCD0= npx convex` parses as
  `CONVEX_DEPLOY_KEY=project:me:new-project | eyABCD0='' npx convex` but when
  was meant was
  `CONVEX_DEPLOY_KEY='project:me:new-project|eyABCD0=' npx convex`.

  Crash when an environment variable like `ey...0=` is present to surface errors
  like this quicker.

## 1.25.0

To upgrade to this release you'll need to upgrade any Convex components you use.

- Set `process.env.NODE_ENV = "production"` during Convex function bundling.
  This will result in different code being bundled from some packages, generally
  faster code.

- Smaller bundles via esbuild minification.

- ConvexHttpClient mutations are now queued by default, making the
  ConvexHttpClient match the behavior of ConvexClient and ConvexReactClient.
  This makes switching between these safer.

  If you need unqueued mutations (you need to run multiple mutations
  concurrently), pass the unqueued: true option or create a separate
  ConvexHttpClient for each queue of mutations you need.

- Allow passing auth to ConvexHttpClient as an option in the constructor. This
  is appropriate for short-lived ConvexHttpClients and it more convenient for
  instantiating a client and using it in a single expression.

- Restore check that Convex functions are not imported in the browser.

  Convex functions run in a Convex deployment; including their source in a
  frontend bundle is never necessary and can unintentionally reveal
  implementation details (and even hardcoded secrets).

  This check current causes a `console.warn()` warning, but in future versions
  this will become an error. If you see the warning "Convex functions should not
  be imported in the browser" you should address this by investigating where
  this is being logged from; that's code you don't want in your frontend bundle.
  If you really want your Convex functions in the browser it's possible to
  disable this warning but this is not recommended.

- TypeScript error when async callbacks are passed to
  `mutation.withOptimisticUpdate()`: an optimistic update function is expected
  to run synchronously.

- Experimental onServerDisconnectError() callback option for Convex clients.

  This is a stopgap client callback to report unusual server disconnect errors.
  The content of these messages, which messages trigger the callback, and the
  existence of the callback are all subject to change as we develop better
  interfaces for disconnect metrics.

## 1.24.8

- Restore short retry timer for WebSocket reconnects initiated by an error on
  the client. This behavior was inadvertently changed in 1.24.7.

## 1.24.7

- Increase WebSocket client timeouts in general and especially for abnormal
  server errors. See
  [this incident postmortem](https://news.convex.dev/how-convex-took-down-t3-chat-june-1-2025-postmortem/)
  for more context.

## 1.24.6

- Fix another bug with new Custom JWT auth support in projects that use Convex
  backend components.

## 1.24.5

- `ConvexClient.mutation()` now accepts a third `options` argument that can
  contain an optimistic update.

## 1.24.3

- Add `.url` property to ConvexReactClient.

- Earlier errors when invalid objects are passed to `defineTable()`.

## 1.24.2

- Fix bug with new Custom JWT auth support in projects that use Convex backend
  components.

- Support larger data imports from the command line by choosing larger chunk
  size when necessary.

- Calling setAuth on a disabled ConvexClient is now an no-op.

- Add `npx convex dash` alias for dashboard command.

- Limit the number of nested query operators to 256.

## 1.24.1

- Accept `true` and `false` as values for logger in all clients, making
  disabling logs from convex functions run on a development deployment simpler:
  it's no longer necessary write your own no-op logger.

## 1.24.0

- Drop support for React 17 and remove use of `unstable_batchedUpdates` as React
  18 introduced
  [Automatic batching](https://react.dev/blog/2022/03/29/react-v18#new-feature-automatic-batching)

  If you use React 17 and choose to override the change in supported peer
  dependencies (please don't), you may notice query updates are no longer
  batched: it's possible for one Convex query update to occur on a different
  React render than another causing single frames of discrepancies in UI or
  worse, errors if you have code that relies on the client-side consistency like
  client-side joins.

  You may also notice nothing. Without batched updates some queries may be a few
  milliseconds ahead of other queries, which is still much less than the
  differences in other data fetching solutions, e.g. React Query or SWR, in
  non-batched mode.

- Remove dependency on `react-dom`, making it possible to use on "React Native
  only" projects without overriding any dependency resolution.

- New optimistic update helpers for paginated queries: three helpers
  `insertAtTop`, `insertAtBottomIfLoaded`, and `insertAtPosition`.

- The `npx convex login --login-flow paste` flag can be used to explicitly opt
  into the manual token paste login method.

- Fix MCP servers for self-hosted deployments: previously MCP CLI commands were
  attempting to contact a cloud deployment (which didn't exist) in self-hosted
  setups.

- New `compareValues` function exported from `convex/values` which matches
  Convex values semantics as implemented in backends. This function should match
  the Rust implementation in backend (and it property-tested in pursuit of
  this!) but in the event of discrepancies the Rust implementation should be
  considered authoritative.

## 1.23.0

- `npx convex dev` now supports the option of running Convex locally without an
  account

## 1.22.0

- Options for turning off MCP tools and blocking prod deployments (see
  `npx convex mcp`)
- Add `--run-sh` option to `npx convex dev`, similar to `--run` but for shell
  commands
- Add `inflightMutations` and `inflightActions` to
  `convexClient.connectionState()`

## 1.21.0

- `npx convex dev` tails logs by default. See the `--tail-logs` option for more.

- Improvement to the `.unique()` error message to print `_id`s
  [PR](https://github.com/get-convex/convex-backend/pull/59)

- Fixes to avoid race conditions in auth
  [PR](https://github.com/get-convex/convex-js/pull/29)

## 1.20.0

- Calling registered functions directly like helper functions no longer
  typechecks. See release notes for 1.18.0 for more.

- Upgrade esbuild for a sourcemap bug fix.

- Fix FieldTypeFromFieldPath to handle union of nested values and primitives.

## 1.19.5

- `npx convex mcp start` runs an MCP server. AI agents can introspect deployment
  schema (both declared and inferred) and function APIs, read data from tables,
  call functions,and write oneoff queries in JS.

## 1.19.3

- Upgrade esbuild from 0.23 to 0.25 to address security warnings about
  https://github.com/evanw/esbuild/security/advisories/GHSA-67mh-4wv8-2f99

  Convex does not use the development server functionality of esbuild which
  contains the vulnerability.

## 1.19.2

- Improved support for working with self-hosted deployments: every command that
  makes sense (e.g. not `npx convex login`) works with self-hosted deployments.

  The environment variables `CONVEX_SELF_HOSTED_URL` and
  `CONVEX_SELF_HOSTED_ADMIN_KEY` are now used to identity self-hosted
  deployments.
  https://github.com/get-convex/convex-backend/tree/main/self-hosted#self-hosting-convex
  for more.

- export the `ValidatorJSON` record types.

## 1.19.0

- Support for Local Deployments, now in beta. See
  https://docs.convex.dev/cli/local-deployments for more.

  Local deployments run your Convex dev deployment for your project on your
  local machine, which should make syncing your code faster. It also makes
  resources used during development like function calls and database bandwidth
  free, since it's your own compute resources you're using!

## 1.18.0

- Warn on direct Convex function call. This adds a console.warn whenever a
  Convex Function (mutation, query, action, internalMutation, etc.) is called
  directly

  ```ts
  export const foo = mutation(...);

  export const bar = mutation({
    args: v.any(),
    returns: v.any(),
    handler: (ctx, args) => {
      const result = await foo();
    })
  }
  ```

  because this pattern causes problems and there are straightforward
  workarounds. The problems here:
  1. Arguments and return values aren't validated despite the presence of
     validators at the function definition site.
  2. Functions called this way unexpectedly lack isolation and atomicity. Convex
     functions may be writting assuming they will run as independent
     transactions, but running these function directly breaks that assumption.
  3. Running Convex functions defined by customFunctions like triggers can cause
     deadlocks and other bad behavior.

  There are two options for how to modify your code to address the warning:
  1. Refactor it out as a helper function, then call that helper function
     directly.
  2. Use `ctx.runMutation`, `ctx.runQuery`, or `ctx.runAction()` instead of
     calling the function directly. This has more overhead (it's slower) but you
     gain isolation and atomicity because it runs as a subtransaction.

  See
  https://docs.convex.dev/understanding/best-practices/#use-helper-functions-to-write-shared-code
  for more.

  Filter to warnings in the convex dashboard logs to see if you're using this
  pattern.

  For now running functions this way only logs a warning, but this pattern is
  now deprecated and may be deleted in a future version.

- Support for Next.js 15 and
  [Clerk core 2](https://clerk.com/docs/upgrade-guides/core-2/overview):
  `@clerk/nextjs@5` and `@clerk/nextjs@6` are now known to work to Convex. Docs,
  quickstarts and templates have not yet been updated. If you're upgrading
  `@clerk/nextjs` from v4 or v5 be sure to follow the Clerk upgrade guides as
  there are many breaking changes.

- Improvements to `npx convex run`:
  - Better argument parsing with JSON5 so `{ name: "sshader" }` parses
  - support for `--identity` similar to dashboard "acting as user" feature, like
    `npx convex run --identity '{ name: "sshader" }'`
  - `npx convex run api.foo.bar` is equivalent to `npx convex run foo:bar`
  - `npx convex run convex/foo.ts:bar` is equivalent to `npx convex run foo:bar`
  - `npx convex run convex/foo.ts` is equivalent to `npx convex run foo:default`

- Allow non-JavaScript/TypeScript files in the `convex/` directory. Only .js
  etc. files will be bundled and may define Convex functions points but adding a
  temporary file like `convex/foo.tmp` will no longer break` the build.

- Fix type for FieldTypeFromFieldPath with optional objects.

- Fix types when a handler returns a promise when using return value validators
  with object syntax.

## 1.17.4

- Revert use of the identity of useAuth from Clerk to determine whether
  refreshing auth is necessary. This was causing an auth loop in Expo.

## 1.17.3

- Fetch a new JWT from Clerk when using Clerk components to change the active
  orgId or orgRole in React on the client. Any auth provider can implement this
  by returning a new `getToken` function from the `useAuth` hook passed into
  `ConvexProviderWithAuth`.

## 1.17.2

- Revert local Prettier settings change described in 1.17.1 which removed angle
  brackets in some cases where local prettier config used plugins.

- `npx convex import --replace-all` flag which behaves like the Restore
  functionality in the dashboard.

## 1.17.1

- Use local Prettier settings to format code in `convex/_generated` if found.
- Extend supported react and react-dom peerDependencies to include v19
  prereleases. This is temporary, only stable React 19 releases will be
  supported in the long term.
- Hook up Sentry reporting for local deployments, opted-into by
  `npx convex dev --local`. This telemetry will be made configurable before this
  feature is released more broadly. This is being called out here for
  transparency regarding telemetry, but this `--local` feature is not yet ready
  for general consumption. Please don't use it unless you're excited to help
  test unfinished features and willing to have errors submitted to Convex.
- Don't try to bundle .txt or .md files in the convex/ directory.
- Don't include credentials in HTTP client requests.

## 1.17.0

- Disallow extra arguments to CLI commands.
- `--component` flags for `convex import` and `convex data`.
- `--run-component` flag for `convex dev --run`
- Remove prettier-ignore-start directives from generated code.
- Fix file watcher bug where a syntax error could cause a file to stop being
  watched.
- Downgrade jwt-decode dependency back to ^3.1.2.
- Change refresh token renewal timing

## 1.16.6

- Detect TanStack Start projects and use environment variable name
  `VITE_CONVEX_URL`.

## 1.16.5

- restore `--run` flag of `convex import`

## 1.16.4

- Don't typecheck dependent components by default, add `--typecheckComponents`
  flag to typecheck.

## 1.16.3

- Fix some library typecheck errors introduced in 1.16.1. Workaround for
  previous versions is to add `"skipLibCheck": true` to the tsconfig.json in the
  convex directory.

## 1.16.2

- Change some language around components beta.

## 1.16.1

- Release components, a feature in beta. These codepaths should not be active
  unless a convex directory contains a file named `convex.config.ts`. Components
  aren't documented yet and may change significantly before general release.

## 1.16.0

- Added support for a new validator, `v.record`. This is a typed key-value
  object in TypeScript. More information can be found in the
  [docs](https://docs.convex.dev/functions/validation#record-objects).
- Upgrade esbuild from 0.17 to 0.23. It's possible to use an npm override to use
  a different version of esbuild if you need to stay on an older version,
  although changes to the esbuild API could break this in the future.

  See
  [esbuild changelog](https://github.com/evanw/esbuild/blob/main/CHANGELOG.md)
  for the full list of changes. One standout: tsconfig.json is no longer used by
  esbuild for `jsx` setting. Convex now sets it manually to
  ["automatic"](https://esbuild.github.io/api/#jsx).

## 1.15.0

- Added new command, `npx convex function-spec`, that exposes the function
  metadata (name, type, validators, visibility) of functions defined in your
  Convex deployment
- Generated code no longer includes the "Generated by convex@version" comment
- Fix issue with `convexClient.query()` so it always returns a Promise

## 1.14.0

- Updates to ConvexReactClient to work better with authentication and server
  rendering
- `npx convex init` and `npx convex reinit` have been deprecated in favor of
  `npx convex dev --configure`
- Drop support for Node.js v16, and with it drop the dependency on node-fetch.
  This removes the 'punycode' deprecation warning printed when running the CLI
  in more recent versions of Node.js.
- Support for custom claims in JWTs

## 1.13.2

- Fix `npx convex import` regression in 1.13.1

## 1.13.1

- Relax client URL validation to prepare for Convex backends accessible on
  arbitrary domain. This makes `skipConvexDeploymentUrlCheck` client option also
  no longer required for accessing deployments not hosted on the Convex BaaS.

- Fix bug where the first mutation request send over the WebSocket failing would
  not roll back the corresponding optimistic update (completedMutationId could
  be 0 which is falsey!)

- Fix bug where `codegen --init` would fail if no Convex directory existed yet.

- Action and query function wrappers now also allow validators for args
  (previously only objects were accepted) and objects for returns (previously
  only validators were accepted).

- Change `httpRouter` behavior for overlapping paths: exact matches first, then
  the longest prefix patch that matches.

## 1.13.0

- Convex queries, mutations, and actions now accept `returns:` property to
  specify a return value validator.

  Return value validators throw a runtime error (so will roll back the
  transaction in a mutation) when the value returned from a query or mutation
  does not match this validator. This is _stricter than TypeScript_ in that
  extra properties will not be allowed.

- Validator fields are now exposed: the return value of `v.object({ ... })` now
  has a `.fields` property with the validators for each property on it.

  ```
  const message = v.object({ user: v.string(), body: v.string() });
  const imageMessage = v.object({ ...message.fields, })
  ```

  These validators are also exposed on the schema at
  `schema.tables.messages.validator`

  The `Validator` export is no longer a class. It is now a discriminated union
  type of all validators where the `.kind` as the discriminator. The `Validator`
  type still has three type parameters with only the first (the TypeScript type
  enforced by the validator) required.

  The second type parameter IsOptional is no longer a boolean, is it "optional"
  or "required" now.

  These are breaking changes if you're using the two optional type parameters of
  `Validator` or doing `instanceof` checks with `Validator`! We apologize for
  the inconvenience. The same users this affects should be the ones that most
  benefit from the ability to work with validator types more directly.

- Argument validators now accept validators (object validators and union
  validators) in addition to objects with validators as properties. Return value
  validators similarly accept either validators or objects with validators as
  properties, but unlike `args:` any validator is allowed.

  Custom function wrappers (AKA middleware) should continue to work, but to
  present the same API has the builtin Convex function wrappers `query`,
  `internalQuery`, `mutation` etc. you'll need to update such code to accept
  either a validator or an object of validators. You'll likely want to update
  these anyway to support return value validators. The new `asValidator` helper
  maybe useful here.

- The default tsconfig.json created in projects when first creating the
  `convex/` directory now uses `"moduleResolution": "Bundler"`. This is just a
  better default, you
  [probably never want the previous default `"node"`/`"node10"`](https://www.typescriptlang.org/tsconfig/#moduleResolution).

## 1.12.1

- Fix bug where `npx convex deploy` and `npx convex dev` would incorrectly skip
  pushing if the only change was removing files

## 1.12.0

- `npx convex env set` works with `ENV_VAR_NAME=value` syntax

## 1.11.3

- Fix bug when filling out an empty env file
- Exclude files beginning with # from convex directory entry points
- Warn when pushing with an https.ts file
- throw if argument to Query.take() is not an integer

## 1.11.2

- Fix timestamps in npm convex logs

## 1.11.1

- Allow Clerk 5 (currently in beta) in convex peerDependencies
- Fix typechecking bug on Windows caused by the Node.js patch for CVE-2024-27980
  that makes running tsc.CMD directly no longer work
- Exclude jsonl from convex directory entry points
- Add autocomplete for project selection in new project flow
- output debugBundlePath as full bundle instead of as a single file

---

Find release notes for versions before 1.11.3 on the
[Convex Blog](https://news.convex.dev/tag/releases/).
