---
'@mastra/discord': patch
---

Fixed Discord installs staying "pending" forever after the operator completed the bot invite. The invite URL carries no `redirect_uri`, so nothing calls back when the bot is authorized — and a pending install has no adapter, so no interaction could activate it either. `connect()` now snapshots the bot's guild membership when it issues an invite, and `listInstallations()` reconciles: when exactly one guild has appeared since the snapshot (and no other pending install could claim it), the install activates through the same path as a first interaction — so a UI that refetches installations when the operator returns now shows "Connected" without waiting for someone to use the bot. Ambiguous diffs (zero or multiple new guilds, unknown membership) stay pending and fall back to first-interaction activation, as before.
