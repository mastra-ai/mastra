---
'@mastra/core': patch
---

Fixed durable agent runs being aborted about 5 seconds after they are resumed on a different process. When a run paused on a suspending tool (for example `ask_user`) and was resumed by another replica, the process that started it kept renewing the thread lease, and once the resume took that lease it aborted the run by id, killing the live resumed stream. The starting process now drops its paused copy of the run locally instead, so multi-replica deployments with memory no longer need sticky sessions for resumes.
