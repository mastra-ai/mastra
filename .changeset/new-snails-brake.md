---
'mastra': patch
---

Preflight remediation messages now scope `mastra env db create` to the target environment as a positional argument (`mastra env db create production --kind turso`) instead of the unscoped form. There is no `--env` flag — the environment is a positional arg on this command. After the earlier default-scope change, running the unscoped command in CI (where preflight failures land) errors out on projects with more than one environment because it cannot prompt. The scoped form is copy-pasteable and works everywhere.
