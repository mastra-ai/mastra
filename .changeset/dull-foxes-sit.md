---
'@mastra/deployer': patch
---

Fixed deployer analysis to use one deterministic external dependency set across analysis, bundling, and validation. Deprecated externals such as `nodemailer`, `jsdom`, `sqlite3`, and `fastembed` are now declared and installed as runtime dependencies instead of bundled. This can cause a one-time experiment-worker digest and build-key change for affected projects.
