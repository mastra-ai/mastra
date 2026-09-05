---
'@mastra/factory': patch
---

A board card announces an automated run once. While the run's session is live the card shows only its session marker, orange while the sandbox comes up and green once the agent is working; the "Automated run in progress…" row is gone, along with its copy that lingered on a card in Done until the dispatcher saw the run end. Sidebar rows read the same order, so a session whose sandbox is still materializing shows as initializing even after its run is registered. The sidebar lists a session the dispatcher created as soon as the run registry shows a run on it, instead of on the next reload.
