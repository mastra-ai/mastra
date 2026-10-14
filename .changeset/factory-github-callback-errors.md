---
'mastra': patch
---

Factory now explains why connecting GitHub through Mastra Platform didn't work, instead of returning silently to onboarding or settings. If the GitHub account already had the Mastra GitHub App installed before the link, it says to uninstall the App from that account and choose Connect GitHub again. It also gives plain reasons when you need to sign in to Mastra Platform first, when the link was started for a different account, was opened in another browser, or was already used, when only the GitHub account owner can link the installation, and when your Mastra account is already connected to a different GitHub account that must be disconnected first.
