---
'@mastra/core': patch
---

Fixed restart and time travel of workflow runs that contain a `.sleep()` or `.sleepUntil()` without an `id`. When another process restarted or time traveled such a run, the step after the sleep got no input, because each process gave the sleep a different random id. Unnamed sleeps now get the id `sleep_<workflowId>_<n>`, where `n` follows the order the sleeps are declared in, so every process agrees. Runs stored before this version keep their random sleep ids and still won't match after a restart or time travel. Scheduled workflows with an unnamed sleep now have the same definition hash on every instance, so an instance no longer refuses a schedule another instance registered. Adding or removing a sleep changes the ids of the unnamed sleeps after it; pass `{ id }` to keep one fixed:

```ts
workflow.sleep(5000, { id: 'wait-for-payment' });
```
