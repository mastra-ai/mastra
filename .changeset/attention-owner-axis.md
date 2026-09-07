---
'@mastra/factory': patch
---

The attention inbox now reports counts and the newest item per kind, and the UI decides what interrupts a person. Runs waiting for approval leave the sidebar badge, its preview, and the notification sound; the inbox page files them under "Waiting for approval", above "Activity". The sidebar asks the route for the kinds it shows with a repeatable `kind` query, which replaces the `tier` switch.
