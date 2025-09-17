---
'@mastra/deployer': patch
'@mastra/core': patch
'mastra': patch
---

Add support for running the Mastra dev server over HTTPS for local development.

- Add `--https` flag for `mastra dev`. This automatically creates a local key and certificate for you.
- Alternatively, you can provide your own key and cert through `server.https`:

    ```ts
    // src/mastra/index.ts
    import { Mastra } from "@mastra/core/mastra";
    import fs from 'node:fs'

    export const mastra = new Mastra({
      server: {
        https: {
          key: fs.readFileSync('path/to/key.pem'),
          cert: fs.readFileSync('path/to/cert.pem')
        }
      },
    });
    ```
