---
'@mastra/code-sdk': patch
---

Fixed trusted instruction loading when the project path uses a filesystem alias, including macOS `/var` and `/private/var`. Review sessions keep reading AGENTS.md and CLAUDE.md from the trusted git ref instead of accidentally falling back to checkout content. Untrusted sessions without a trusted base ref still disable checkout instructions; normal trusted sessions continue reading project instructions.
