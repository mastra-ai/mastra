---
'@mastra/deployer': patch
---

Fix deployed studio not allowing custom server URL configuration

- Settings page is now always visible (including on Mastra Platform deployments)
- React Query cache is invalidated when server URL changes in Settings form
- Add `MASTRA_CUSTOM_SERVER_URL` window variable support for platform-injected custom server URLs
