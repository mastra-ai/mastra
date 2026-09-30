# Upstream integration follow-up

Implementation base: upstream `mastra-ai/mastra` commit `ac5ece3a410222ea704d9d10cb6e18ce937680b3`, in the user's existing fork `ojusave/mastra`. Subsequent updates are pushed directly to `ojusave/main`.

All implementation changes are inside `workflows/render/`. The root workspace already includes `workflows/*`. No core, server, sibling provider, root example, root lockfile, root changeset, shared CI or shared documentation was changed. Repository metadata for cloning/remotes/branch setup was separately authorized by the user's fork-and-clone request.

The package uses a reproducible published dependency baseline: Mastra core 1.67.0, Render SDK 1.2.0, Mastra PostgreSQL 1.25.0, Zod 3.25.76 and TypeScript 5.9.3. Local checks against those packages do not establish compatibility with unpublished workspace core. Core source was read to understand public extension points; the adapter does not import private source paths or copy the core engine.

Before upstreaming or publishing:

1. Agree with Mastra/Render maintainers on package ownership, final package name and support contract. The local package is private and its name is provisional.
2. Verify against the intended Mastra release/workspace core. Broaden peer ranges only with evidence. Run the repository's applicable provider conformance suite once shared-test wiring is authorized.
3. Add the root changeset, workspace lockfile/catalog changes, shared documentation navigation and CI matrix under a separately expanded edit boundary. The normal repository changeset instruction was deferred because the user explicitly restricted implementation changes to this package.
4. Extend the [hosted smoke evidence](hosted-validation.md), which includes a real GPT-4.1 mini agent workflow, with deploy/redeploy during runs, root timeout/process loss, workspace rate pressure, infrastructure failure, submission connection loss, agent tool loops and other model providers. Passing smoke checks do not establish production reliability.
5. Decide whether durable root replay is a requirement for adoption. Opt-in root retries restart the whole graph and isolate attempt snapshots; they do not recover from checkpoints. Keep the default at zero unless the application makes repeated external effects safe.
6. Add an operator reconciliation path for submissions whose provider ID was never persisted. Hosted workers repair a lost caller binding from native task metadata when they start. A submission with no worker claim still needs reconciliation; native idempotency is bounded by time and Workflow version.

The package is implemented, pushed to the user's fork and tested on hosted Render, including real-agent generation subsequently authorized by the user. See `hosted-validation.md` for evidence and defects fixed by those tests. The package remains private and unpublished. Changes are proposed in upstream PR #25515.
