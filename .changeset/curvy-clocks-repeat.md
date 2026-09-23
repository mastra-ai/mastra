---
'mastra': patch
---

Fixed `mastra deploy` aborting on temporary server errors or dropped connections while checking deployment status.

- Status checks retry with backoff until the polling deadline, including when reading a response fails.
- Stalled status requests are cancelled instead of blocking the deploy.
- Retry notices appear at most every 30 seconds and keep streamed deployment logs on screen.
- The CLI confirms when status checks resume.
- If status cannot be confirmed, the CLI says the deployment may still be running and links to the deployment dashboard.
