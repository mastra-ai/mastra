---
'@mastra/code-sdk': patch
---

Fixed cross-agent signals reporting a failed send when the peer had no live thread owner. A high or medium signal to a peer whose session was not holding its thread (not running, restarting, or between claims) came back as "Failed to send agent signal: No claimed thread owner responded", even though the signal was already persisted in the peer's inbox and was processed later. The send result now reports that signal as queued and only reports a failure once the notification has terminally failed.
