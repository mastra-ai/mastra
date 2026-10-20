---
'@mastra/factory': patch
---

Failed chat runs now explain what went wrong and offer the matching next step, instead of showing SDK error names such as `AI_APICallError` with `Bad Request`.

- Credential and quota failures link to the personal or organization model settings that own the credential. When the session runs on a teammate's or the server's credentials, the notice says who has to repair them instead of linking to the viewer's own settings.
- Context-limit and model-configuration rejections open the session model picker.
- Rate limits, timeouts and provider outages offer a **Continue** button on the latest stopped run.
- Every failure keeps copyable diagnostics with the session and thread ids under **Error details**. A generic 400 says plainly that the provider gave no specific reason.
