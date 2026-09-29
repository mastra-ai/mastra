---
'mastracode': minor
'@mastra/code-sdk': patch
---

Added the `/schedules` command for recurring prompts on the current thread.

```text
/schedules create 5m Check whether the build is green
/schedules create 2h ./scripts/check-ci.sh Summarize any failures
/schedules
/schedules delete
```

`create` takes an interval (`Nm`, `Nh`, or `1d`, minimum one minute) and a prompt or a file path. Script files run at fire time and their output becomes the prompt; other files are sent as prompt text. Each fire arrives as a `schedule`-labelled user turn: queued after the current turn if the thread is busy, waking the thread if it's idle, on any thread in the process. Bare `/schedules` lists the thread's schedules; `delete`, `pause`, `resume`, and `run` manage them. Schedules live only in the running Mastra Code process and stop when it exits.
