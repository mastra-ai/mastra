---
'@mastra/factory': patch
---

Factory now sends the signed-in user's id when it starts a Mastra Platform GitHub App install and when it lists installations. It merges the org's installations with the user's, so personal-account installs can show up during onboarding. Before, onboarding could get stuck on "Choose your codebase" for these installs. This needs Mastra Platform to support `userId` on those endpoints. When no installation is accessible, `/web/github/status` now includes a `userConnectionReason` field that explains why.
