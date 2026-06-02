---
'@mastra/langsmith': patch
'@mastra/nestjs': patch
'@mastra/slack': patch
'@mastra/core': patch
'@mastra/auth-better-auth': patch
'mastracode': patch
---

Updated dependencies to remediate known security advisories.

- **@mastra/langsmith**: Bumped `langsmith` to `^0.6.0` to fix a high-severity advisory.
- **@mastra/auth-better-auth**: Bumped `better-auth` to `^1.6.2` to fix a security advisory.
- **@mastra/core**: Bumped `picomatch` to `^4.0.4` to fix a ReDoS advisory.
- **mastracode**: Bumped `yaml` to `^2.8.3` to fix a parser advisory.
- **@mastra/slack** and **@mastra/nestjs**: Moved `vitest` (dev dependency) to the workspace-pinned `4.x` to clear a critical advisory in the test tooling.

No public APIs change.
