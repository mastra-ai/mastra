---
"@mastra/auth-studio": minor
---

Add configurable cookie domain support

- Add `cookieDomain` option to `MastraAuthStudioOptions` for explicit configuration
- Support `MASTRA_COOKIE_DOMAIN` environment variable as fallback
- Use hostname-based detection for auto-detecting `.mastra.ai` domain (prevents false positives from malicious URLs)
- Maintain backward compatibility with existing `.mastra.ai` auto-detection
