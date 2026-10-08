---
'@mastra/factory': minor
---

Sessions boot every repository in the Factory environment instead of one linked repository.

- The sandbox template is built from every environment repository in position order; each is cloned under the workspace root, which becomes the session's working directory.
- The session branch is resumed where the remote has it; a repository's setup command is skipped when the template already ran it; the workspace setup command runs last.
- A `factory-environment` state signal tells the agent which repositories are present, where, and on which branch.
- Every repository is torn down when the session retires.
