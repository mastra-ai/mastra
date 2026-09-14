---
'mastra': patch
---

Fixed Studio chat model selections and settings resetting after navigation or refresh. Preferences are now saved per chat in the browser and restored for subsequent requests without leaking between chats. Explicitly cleared settings remain cleared after refresh. Previously saved agent-wide settings are not carried over; chats without saved per-chat preferences start from agent defaults. Existing per-chat preferences are preserved. Restored model selections respect the current admin model policy.
