---
'@mastra/core': patch
'mastracode': patch
---

Fixed goals falsely appearing cancelled while their stored objective is still active.

`beginGoalActivity` memoized the objective read taken at run start, including a miss. Because the goal
state processor treated a cached miss as authoritative, an objective written after that read — a goal
started or restarted while a run was in flight — was retracted with `status: none` for the next
projection step, and the model reported the goal as cancelled. A miss is no longer cached, and the state
processor falls through to the store when the cache carries no objective. The cache-hit deduplication the
cache exists for is unchanged.

Separately, MastraCode's `startGoal` computed `shouldPersistToCreatedThread` after creating the thread, so
on the new-thread path the flag was always false. Since `thread_created` is dispatched through a serial
async queue, its handler ran during the subsequent `setGoal` await, took the `loadFromThreadMetadata`
branch, and nulled the just-set goal — the following save then cleared the stored objective. The flag is
now set before the thread is created.
