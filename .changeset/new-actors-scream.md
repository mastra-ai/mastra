---
'mastra': patch
---

Fixed Studio chat model selections and settings resetting after navigation or refresh. Preferences are now saved per chat in the browser and restored for subsequent requests without leaking between chats. Explicitly cleared settings remain cleared after refresh. Existing chats inherit previously saved agent settings on their first visit, while new chats start from defaults. Restored model selections respect the current admin model policy.
