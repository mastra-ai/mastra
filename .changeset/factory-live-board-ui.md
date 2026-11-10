---
'mastra': patch
---

Factory boards now update from the live connection instead of a fixed 2 to 5 second poll.

- **Faster updates.** A change shows within a second when the board hasn't refreshed in the last 5 seconds, and at the 5 second mark otherwise.
- **Fewer requests.** A connected board no longer asks for its cards and decisions every 2 to 5 seconds. It checks once a minute as a safety net, and every 5 seconds if the live connection drops. Running sessions are still checked every 5 seconds.
- **Self-healing connection.** A live connection that goes silent, for example after a server restart behind a proxy, is reopened within about a minute instead of staying dead until the page is reloaded, so comments and boards pick up live updates again.
- **Loading placeholder.** On boards whose first column isn't Intake, that column now shows its loading placeholder while new items load.
