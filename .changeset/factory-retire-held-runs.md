---
'@mastra/factory': patch
---

Finished cards no longer show a stale "Suggested: Start run" button. A run waiting for approval is now retired as soon as its card moves to another stage, so closing an issue while its triage run is waiting clears that run. The cleanup run that tidies a closed issue's labels also starts right away instead of waiting for approval.
