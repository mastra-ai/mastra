---
'mastracode': minor
'@mastra/code-sdk': patch
---

Added the `/schedules` command for recurring prompts on the current thread.

```text
/schedules create 5m Check whether the build is green
/schedules create 2h ./scripts/check-ci.sh Summarize any failures
/schedules
/schedules delete 81923e92
```

`create` takes an interval (`Nm`, `Nh`, or `1d`, minimum one minute) and a prompt or a file path. Script files run at fire time and their output becomes the prompt; other files are sent as prompt text. Each fire shows in the transcript as a `schedule` entry. A busy agent receives it as its next input and an idle thread wakes, on any thread in the process. Bare `/schedules` lists the thread's schedules; `delete`, `pause`, `resume`, and `run` manage them. Schedules live only in the running Mastra Code process and stop when it exits.

An opt-in **Experimental schedule tools** setting in `/settings` lets the agent create and manage schedules on its own thread.
