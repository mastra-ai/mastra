# Shared chat coverage

`AI/Chat` is a composition of Playground UI components, not an application screenshot or a substitute for Studio/Factory integration tests. Every rendered UI import comes from this package.

| Surface             | Shared story coverage                                                                                                                          |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Layout and messages | ChatShell, scrolling, jump to latest, timeline, tasks, text/Markdown, copy actions, timestamps, file previews                                  |
| Composer            | Mode tones, busy ring, round/outline actions, draft attachments, Enter/Shift+Enter, slash suggestions, send/stop and focus                     |
| Model selection     | A combined picker in the default conversation and provider/model segments in `With segmented picker`; catalog and selection are local fixtures |
| Tools               | Grouped reads/search, command output, edit preview, streaming, errors and retry; the command renders only once for its current state           |
| Response flow       | Reasoning, plan, question/answer, standalone approval/decline, response errors and retry                                                       |
| Activity            | Notifications, state/reactive signals, reminders, skill activation, time gaps and linked completion notices                                    |
| Scenarios           | Empty, complete, streaming, stopped, awaiting answer/approval, declined, tool/response errors, long conversation and light theme               |

Individual `Elements/Composer`, `Elements/Composer actions`, `Inputs/Model picker` and tool/event stories cover additional variants, including custom action slots, send alongside stop, packs, loading, disabled, locked, unconfigured, warning and unavailable states. Story args describe component states and scenarios, not application modes.

Studio and Factory retain their own voice and dictation, attachment acceptance and URL handling, model discovery/policy/credentials, settings, permission checks, routing, transport, persistence, session controls and request transformations. None of their source files or `.storybook` folders are imported into this catalog. Their integration tests cover the production behaviors.

The story-only draft and playback hooks provide deterministic interactivity. They do not implement audio, model requests, storage, application providers or a shared chat engine.
