---
'@mastra/factory': patch
---

Factory now explains why a GitHub App install can't be used instead of showing GitHub as not connected. This covers a personal GitHub account install that Mastra Platform hides because the platform org has other members, and installs the platform lists as unusable (for example, when the member who linked it left the platform org). Connections settings, the add-repository picker, and onboarding say why and offer to install the GitHub App on a GitHub organization. When other installs are usable, repositories stay available with a short note.
