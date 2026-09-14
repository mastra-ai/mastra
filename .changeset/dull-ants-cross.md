---
'mastra': patch
---

Fixed `mastra deploy` creating a plain Studio project when deploying a Mastra Factory project for the first time, which left the deployment without workspace sandboxes or the `<slug>.factory.mastra.cloud` route.

**Factory projects on `mastra deploy`**

- New projects for Factory deployments are created with the factory flag, so the platform provisions sandboxes and the Factory route.
- The deployment region is asked once for a new Factory project and reused for its environment.
- Deploying a Factory build into an existing project that was created without Factory support now explains the problem and offers to create a new Factory project instead, since that support cannot be added later.
- `--region` now rejects values other than `us` and `eu` instead of silently ignoring them for the project.

```bash
# from a directory scaffolded with `npm create factory`
mastra deploy --region us
```

**Legacy commands**

- `mastra server deploy` creates Factory projects with the flag and sends it on the deploy request.
- `mastra studio deploy` warns that it cannot enable Factory support and points at `mastra deploy`.
