---
'@mastra/factory': patch
---

Factory now explains why a GitHub App install can't be used instead of showing GitHub as not connected. When a personal GitHub account install is linked to the platform org but not shared with this factory, Connections settings, the add-repository picker, onboarding, and factory creation offer "Share with this factory", which opens the Mastra Platform consent page and refreshes GitHub status on return. Other unusable installs (for example, when the member who linked it left the platform org) say why and offer to install the GitHub App on a GitHub organization. When Mastra Platform withholds repository access, Factory also drops its cached GitHub tokens for that installation so a revoked share stops working right away.
