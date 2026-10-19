---
'@mastra/factory': patch
---

Sessions can now manage the side sessions they start. `factory_list_side_sessions` lists them with state, last report, model, linked work item and mute status, with `state` and `muted` filters. `factory_unsubscribe_session` mutes a side session's reports and run-end notices without stopping it (approval requests still arrive), and `factory_subscribe_session` turns reports back on.
