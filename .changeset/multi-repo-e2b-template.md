---
'@mastra/e2b': minor
---

Add a `repos` form to `createRepoTemplate` that clones several repositories into one E2B template. Each entry has its own `getRepositoryAccess` and `setupCommand`; `workspaceSetupCommand` runs at the working directory after every repository and `continueOnSetupFailure` records failing per-repository setups in `.mastra-sandbox/setup-failed` instead of failing the build. Each repository writes `.mastra-sandbox/repos/<repo>`, public repositories build before private ones, and the tag hashes every pinned sha.

Reorder the single-repository build so the commit pin (`git fetch` + `checkout <sha>`) runs after the first setup pass instead of inside the clone layer, and run the setup commands again after the pin. The clone and install layers now cache across commits for repositories built without a credential (a private repository's token is a build env ahead of the clone, so a rotated token still rebuilds every layer). Setup commands must be safe to run twice in the same checkout. Template names and tags are unchanged, so existing `sha-<sha>` tags keep their old layering and the new layering applies the next time the default branch moves.
