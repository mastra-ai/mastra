---
---

Security-only dependency floors from the 2026-10-29 Vanta pass: fast-uri 4.2.1 -> 4.2.3 (GHSA-333x-w4r6-6crp, GHSA-w74x-v6f9-j3xg, GHSA-wjr9-j795-jxcr, GHSA-xhq7-xmqj-769h) and systeminformation 5.33.13 -> 5.33.16 (CVE-2026-116576, CVE-2026-116673, CVE-2026-116674) via the existing pnpm overrides in the root, nested e2e-tests/examples/observability lockfiles; lockfile-only bumps of systeminformation 5.33.8 -> 5.33.16 in template-customer-refund-agent, re2js 2.8.6 -> 2.8.8 (CVE-2026-116795) and @ai-sdk/provider-utils 3.0.41 -> 3.0.42 (via @ai-sdk/google-vertex 3.0.185 / @ai-sdk/openai-compatible 1.0.59, matching the root) in template-genui-data-explorer. No published package changes.
