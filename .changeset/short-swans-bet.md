---
'@mastra/factory': minor
---

Added a configurable allowlist of reviewer bots that can trigger GitHub review and comment notifications. Set MASTRACODE_GITHUB_AUTHORIZED_BOTS (comma-separated logins) or pass authorizedBots to GithubIntegration to trust bots beyond the built-in defaults; previously only coderabbitai[bot] and devin-ai-integration[bot] were accepted and every other bot was dropped without a log line. Bot logins now match case-insensitively and rejected senders are logged. Fixes #21621
