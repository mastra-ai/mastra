---
'create-factory': patch
---

Stopped writing MASTRA_SHARED_API_URL to the scaffolded project's .env during platform provisioning. Platform consumers now use their built-in default platform URL, so scaffolded factories no longer pin the API endpoint at create time.
