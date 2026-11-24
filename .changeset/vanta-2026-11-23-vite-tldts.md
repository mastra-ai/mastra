---
---

Security: move vite 8.3.4–8.3.6 to 8.3.8 (AIKIDO-2026-137384, dev-server RCE fixed via Rolldown 1.2.18 in vite 8.3.7), tldts 7.4.19 to 7.5.5 (AIKIDO-2026-453894), the docs-only yaml 1.10.2 to 1.10.3 (GHSA-48c2-rrv3-qjmp), @fastify/proxy-addr 5.1.1 to 5.1.3 (AIKIDO-2026-593300) and the minimatch 10.2.6 bundled in aws-cdk-lib to 11.0.9 (GHSA via Dependabot #3353, aws-cdk-lib 2.275.0 to 2.278.0 in the bedrock CDK template) across the root, nested workspace and template lockfiles. Only devDependency ranges, overrides and lockfiles change, so no package release is needed.
