---
'@mastra/github-signals': patch
---

Fixed GitHub PR subscription notifications never firing on macOS. The gitcrawl database location is now resolved by asking gitcrawl itself (with the macOS ~/Library/Application Support location as a fallback) instead of assuming the Linux ~/.config path. Snapshot read failures are no longer silently swallowed - they are recorded on the subscription so polling problems are visible.
