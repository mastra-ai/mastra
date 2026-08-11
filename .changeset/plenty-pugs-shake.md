---
'@mastra/factory': patch
---

Return from deleting a workspace as soon as its session is gone instead of holding the request open while the sandbox is reclaimed. Waking the VM and scrubbing its checkout took minutes on a large repository, so the UI appeared to hang long after the workspace had been removed. The scrub and pool release now run in the background; because a sandbox only becomes claimable once it is published to the reuse pool, the next session still gets a clean checkout.
