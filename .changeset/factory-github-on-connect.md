---
'@mastra/factory': minor
---

Platform GitHub is now event-driven, and organizations can move onto the new Mastra Factory GitHub apps.

**Events instead of polling.** The Mastra GitHub App's webhooks now reach Factory from the Platform events service. Factory no longer polls the platform for them. Reconciles, including the sweep for pull requests opened while events were missed, run hourly. `MASTRA_PLATFORM_GITHUB_POLLING_ENABLED` and `MASTRA_PLATFORM_GITHUB_POLLING_INTERVAL_MS` have been removed. The `MASTRACODE_PLATFORM_GITHUB_*_INTERVAL_MS` variables still set the reconcile cadence.

**Switching to the Mastra Factory apps.** In **Settings → Source control**, an organization admin installs **Mastra Factory** and **Mastra Factory Reviews** on each GitHub account Factory uses, then chooses **Switch**. The page lists any app, account or linked repository the new apps can't reach yet, and the switch waits until there are none. Project links, cards and sessions carry over. After the switch:

- Factory calls GitHub directly with the apps' tokens. Its reviews and review checks come from Mastra Factory Reviews, and everything else from Mastra Factory.
- A person can connect their own GitHub account in **Settings → Connected accounts**, through the Mastra Factory app or with a personal access token. Pull requests and comments they create through Factory are then authored as them.
- Agent sandboxes get a token scoped to their session's repositories, never one for the whole installation.

Organizations that don't switch keep using the Mastra GitHub App unchanged. There is no switch back.
