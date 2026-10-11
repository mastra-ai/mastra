---
'@mastra/factory': patch
---

Fixed Factory onboarding getting stuck on "Connect GitHub" when the Mastra Platform GitHub App is installed on a personal GitHub account. Installs started from Factory are now attributed to the signed-in user, and the installation list is requested on that user's behalf, so personal-account installations show up and connect. When no installation is accessible, `/web/github/status` now includes a `userConnectionReason` explaining why.
