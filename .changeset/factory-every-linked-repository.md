---
'@mastra/factory': patch
'mastra': patch
---

Fixed the Factory board only picking up issues and pull requests from a project's first linked GitHub repository. Previously, repositories you linked later stayed empty until someone opened their issue lists directly.

- Linking a GitHub repository now brings its open issues and pull requests onto the board right away (up to five pages of each). Older items show up as cards but are never auto-started.
- The background issue reconciler for the direct GitHub integration now finds open issues that were missed while webhooks were down, in every linked repository.
- The Intake lane, global search, and the Sessions sidebar now cover every linked repository. Card details load from the repository the card came from, and one repository failing to load no longer blanks the others.
