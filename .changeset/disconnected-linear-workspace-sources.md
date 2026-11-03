---
'@mastra/factory': patch
---

Linear sources saved from a workspace that is no longer connected no longer show up in intake settings as long encoded IDs. They now appear as a single "Other Linear workspace" row marked Disconnected, with Reconnect and Remove actions. The saved sources and their routing are kept, so reconnecting the workspace resumes intake without setting them up again. A saved project or team that no longer exists in a connected workspace is shown as "Unknown Linear project" or "Unknown Linear team".
