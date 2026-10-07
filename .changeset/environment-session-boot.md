---
'@mastra/factory': minor
---

Boot every environment repository into the session sandbox. Session start no longer picks a linked repository: the sandbox template is built from every repository that is in the factory environment, in position order, through the multi-repo template; boot materializes each repository under the workspace root, resumes the session branch only where the remote has it, moves a detached checkout to its default branch, skips a repository's setup command when the template marker is present, runs the workspace setup command last, and tears every repository down on retirement. A session's working directory is the workspace root and a `factory-environment` state signal tells the agent which repositories are present, where, and on which branch. Git transfers against a template checkout are now authenticated whether `origin` carries the `.git` suffix or not.
