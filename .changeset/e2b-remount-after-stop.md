---
'@mastra/e2b': patch
---

E2B sandboxes remount their filesystems when they resume.

`E2BSandbox.stop()` pauses the sandbox, and FUSE mounts do not survive a pause, so mounts are unmounted first. They were also dropped from the mount manager, so nothing remounted them on the next `start()`: the mount path came back as an empty directory, reads returned nothing, and writes landed on the sandbox's own disk. Stopping now keeps the mount configuration registered so resuming re-establishes each mount.
