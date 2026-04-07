---
'@mastra/playground-ui': patch
'@mastra/server': patch
---

**Fixed publishing older agent versions**

Fixed agent editor to allow publishing older read-only versions. Previously, the Publish button was disabled when viewing a previous version. Now a "Publish This Version" button appears, enabling users to set any older version as the published version.

**Fixed Publish button being clickable without a saved draft**

The Publish button is now disabled until a draft version is saved. Previously, making edits would enable the Publish button even without a saved draft, which caused an error when clicked.

**Eliminated spurious 404 error logs for code-only agents**

The agent versions endpoint now checks both code-registered and stored agents before returning 404, and the frontend conditionally fetches stored agent details only when versions exist. This prevents noisy error logs when navigating to the editor for agents that haven't been published yet.

**Changed editor sections to be collapsed by default**

The System Prompt, Tools, and Variables sections in the agent editor are now collapsed by default when navigating to the editor page.
