---
'create-mastra': patch
'mastra': patch
---

Improve the overall flow of the `create-mastra` CLI by first asking all questions and then creating the project structure. If you skip entering an API key during the wizard, the `your-api-key` placeholder will now be added to an `.env.example` file instead of `.env`.
