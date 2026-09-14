# Source-backed API reference

The pilot extracts `Config` and `Agent.generate()` from source into committed JSON under `docs/src/data/api-reference`. MDX selects complete surfaces from those artifacts. TypeDoc runs only through the explicit generation and freshness commands, not through ordinary docs development or builds.

## Update an API description

Run these commands from the repository root:

```sh
pnpm install --frozen-lockfile
pnpm turbo build --filter ./packages/core
pnpm --filter mastra-docs api:generate
pnpm --filter mastra-docs api:check
```

The core build supplies workspace dependencies needed for extraction. After setup:

1. Edit JSDoc on the owning source declaration. Verify descriptions, defaults and examples against implementation and tests. Do not edit the generated JSON or copy API inventories into MDX.
2. Run `api:generate`. Review warnings and the entire JSON diff, including nested declarations and exact source annotations.
3. Run `api:check`. It generates into a fresh temporary directory, validates both artifact schemas and roots, and compares every byte with the committed inventory. Missing, extra, obsolete, malformed and changed artifacts fail. The check never updates the checkout.
4. Preview with `pnpm --filter mastra-docs dev`. Ordinary development reads committed artifacts, so source-only edits require explicit regeneration before previewing.
5. Commit source comments and the regenerated artifacts together after verification.

`api:generate` stages the complete validated output before replacing its owned artifact directory. Failed conversion does not reuse an older result. Do not store handwritten files in that directory.

## Compose complete surfaces

Use literal, standalone selectors with no import in authored MDX:

```mdx
<ApiReference root="Config" section="properties" />

<ApiReference root="Agent.generate" section="method" />
```

Use each selector on its corresponding reference page. Keep introductions, contextual examples and narrative in MDX. Do not select individual fields or pass JavaScript expressions, spread props or manually composed data. The transform generates page-local data and headings.

The method surface includes all overloads, parameters and returns. Its compact call heading is not an exact TypeScript declaration. The full declaration remains in the native disclosure. Overload-specific options use built-in tabs; linked supporting types have a generated appendix. Configuration children remain inline. See `docs/styleguides/COMPONENTS.md` for presentation guidance.

## Comments and validation

Descriptions come from the complete rendered owned-data graph, including nested fields and supporting definitions. Closing a declaration or switching tabs does not exempt its contents. Unused declarations and link-only service or external targets are not description requirements for that page.

Development shows missing-description diagnostics. Production rejects missing consumed descriptions and unresolved included comment links. This validation uses the current MDX and committed JSON independently of freshness: unchanged source artifacts do not excuse an invalid page.

Comments support the renderer's restricted Markdown, including prose, lists, code, safe links, examples, defaults and deprecation callouts. Executable HTML/JSX and unsafe URLs are rejected. Do not rely on arbitrary MDX components inside JSDoc. Built-in example tabs and API anchors are preserved in Markdown output.

## Source provenance

Production source links require `API_REFERENCE_SOURCE_REVISION` to equal the full checked-out commit SHA. Every linked source file must exist at that revision and match its working-tree bytes. Dirty source comments can therefore fail a production build even when artifact freshness passes. After committing the intended source and artifacts, build from the docs directory with:

```sh
API_REFERENCE_SOURCE_REVISION="$(git rev-parse HEAD)" pnpm run build
```

Development without a verified revision shows unlinked source locations instead of inventing permalinks. A local freshness or build result does not establish remote revision reachability or deployment-check configuration.

## CI and read-only checks

`api-reference.yml` runs on pull requests and pushes without path filters. It explicitly checks out the pull-request head SHA or pushed SHA, builds extraction prerequisites, runs `api:check`, validates current MDX with `api:validate`, and checks public source-revision reachability. Page validation reads committed artifacts and writes temporary payloads outside the checkout; it does not run TypeDoc.

The separate `api-reference-result.yml` reports the stable `api-reference` check on the validation run's head SHA. Its privileged job reads only GitHub run/job metadata: it does not check out pull-request code, download artifacts, restore caches, or receive repository secrets. Failed, cancelled or skipped validation is not reported as success. This reporter must exist on the default branch before its workflow-run trigger can be exercised; local tests do not establish live fork-origin check visibility.

Run the repository-side preflight with explicit identifiers:

```sh
API_REFERENCE_SOURCE_REVISION="$(git rev-parse HEAD)" \
GITHUB_REPOSITORY=mastra-ai/mastra \
pnpm --filter mastra-docs exec tsx scripts/api-reference/publication.ts
```

The preflight makes an unauthenticated GitHub commit request, verifies the returned SHA, and rejects a revision different from local HEAD. It never requires a deployment ID. Add `--audit-checks` to inspect reported GitHub results read-only; absent, pending, unsuccessful, wrong-SHA, unrecognized or wrong-app results fail. Run and attempt identities prevent a late older report from overriding a newer reported attempt in this audit.

Vercel integration, project settings, check binding, promotion-state auditing and real deployment exercises are deferred. These commands do not configure deployment protection, verify promotion, or authorize a push. A successful local or GitHub check alone is not publication evidence.
