---
'@mastra/memory': patch
---

Subconscious pins now use the session's ordinary Knowledge authority. Pinning, unpinning, and editing a pin need the matching grant on the resource or thread scope. Pins the session can no longer read are left out of the pinned context. Pin tools fail closed when no Knowledge instance is configured. Editing a pin first checks that the session may remove the original. It then adds the replacement before removing the original, so a failed edit keeps the existing pin and does not leave a duplicate behind.
