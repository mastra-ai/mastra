---
'create-mastra': patch
'mastra': patch
---

create-mastra now tells the scaffolder to use the same version number as the create package you ran, so `npm create mastra@1.2.3` gives you the CLI and matching libraries at 1.2.3.

mastra no longer retries failed installs during `create` by switching to the newest published release; the first error is shown instead.
