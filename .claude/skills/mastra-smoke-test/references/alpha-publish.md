# Alpha Publish Verification

Use this after the alpha versioning PR has merged.

## Confirm the automatic alpha publish workflow

Merging the alpha versioning PR to `main` automatically kicks off the `Publish to npm` workflow on a `push` event. Do **not** advise manually starting the alpha publish workflow.

Check for the automatic run:

```bash
gh run list --workflow "Publish to npm" --branch main --limit 5
```

Inspect the newest run. The alpha path should be the `prerelease` job, with `snapshot`, `stable`, and `enter_prerelease` skipped:

```bash
gh run view <run-id> --json name,event,status,conclusion,workflowName,headBranch,headSha,jobs,url --jq .
```

Watch it:

```bash
gh run watch <run-id>
```

Offer to open the prerelease run in the user's browser when helpful:

```bash
gh run view <run-id> --web
```

Use `gh run view --web` instead of browser automation because it opens the page in the user's normal browser/session.

If no automatic publish run starts after the merge, report that as a release automation issue and ask the user before taking any recovery action.

## Confirm alpha is published

Before smoke testing, confirm the alpha package is installable:

```bash
npm view @mastra/core@alpha version
npm view mastra@alpha version
npm view create-mastra@alpha version
```

Only then create the smoke-test project with the alpha tag/version.

## Next step

After alpha packages are published, continue with release scope discovery in `references/release-scope-discovery.md`, then run the mandatory local checklist from `SKILL.md` plus any targeted checks.
