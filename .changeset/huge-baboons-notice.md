---
'mastracode': minor
---

Added the `/schedules` command for recurring prompts on the current thread. `/schedules` opens a menu to create a schedule (a prompt, a prompt file, or a script whose output becomes the prompt, on a cadence from one minute to one day) and to run, pause, resume, or delete existing ones. Each fire shows in the transcript as a `schedule` entry. A busy agent receives it as its next input and an idle thread wakes. Schedules live only in the running Mastra Code process and stop when it exits.

An opt-in **Experimental schedule tools** setting in `/settings` lets the agent create and manage schedules on its own thread.
