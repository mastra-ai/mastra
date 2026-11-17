---
'@mastra/factory': minor
---

Factory now publishes agent and UI commits as signed commits. When a workspace is connected through the GitHub App, pushing a session branch asks GitHub to create the commits server-side with the App's installation, so they carry GitHub's own signature and pass a branch protection rule that requires signed commits. No signing key is ever placed in the session sandbox.

Signing is attempted first and the commits keep their messages, order and file contents. When a commit cannot be expressed — for example it changes a file mode, adds a symlink or a submodule, or touches more files than the API accepts in one commit — Factory publishes nothing signed and pushes the branch the ordinary way, so nothing is half-rewritten. After a signed push the session branch is reconciled onto the new commit ids, so the next push still fast-forwards.

The push endpoints now also report whether the push was signed: `POST /web/github/projects/:id/push` returns `headSha` alongside `signed`, and the agent's `source_control_push_branch` tool returns `signed` with an optional `signedFallback` naming why signing was skipped.
