---
'mastra': patch
---

Fixed `mastra studio deploy --project <name>` and `mastra server deploy --project <name>` so that passing a project name now works as documented.

**What changed**

- The `--project` flag now matches projects by name, in addition to id and slug.
- When no project matches, the CLI creates a new project (after a confirmation prompt, or immediately with `--yes`).

**Why**

Previously, passing a name that didn't match an existing slug or id silently wrote the raw string into `.mastra-project.json` as the project ID. The deploy then failed against a project ID that does not exist, and `.mastra-project.json` had to be hand-edited before retrying.

```bash
# Before: silently wrote { projectId: 'my-app' } and failed
mastra server deploy --project my-app --yes

# After: matches an existing project named 'my-app', or creates it
mastra server deploy --project my-app --yes
```
