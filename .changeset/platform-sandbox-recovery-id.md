---
'@mastra/platform-workspace': patch
---

`PlatformSandbox` now includes its caller-facing `id` on the `POST /v1/projects/:projectId/sandbox` wire body when provisioning a new sandbox. The Mastra Platform treats this as an advisory recovery key so callers can opt into checkpoint-based sandbox recovery — if the platform recognizes the id from a previous session, the new sandbox boots from the most recent checkpoint instead of the base template. Unknown ids fall through to a fresh sandbox, so existing callers see no change in behavior.

No API changes — the value sent is the same `id` you already pass to `new PlatformSandbox({ id })` (or the auto-generated one).
