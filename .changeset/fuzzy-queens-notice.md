---
'@mastra/factory': patch
---

Fixed chat busy-state races by ordering session-state snapshots and run events with the server's new `stateVersion` stamp instead of arrival order and local clocks. A stale snapshot can no longer resurrect an ended run, a late-delivered event can no longer hide a newer snapshot, and after a lost `agent_end` the composer leaves its busy state only on a snapshot that provably postdates the send.
