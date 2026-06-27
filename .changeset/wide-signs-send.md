---
'@mastra/core': patch
---

Fixed channel broadcasting so agent runs on a channel-backed thread post back to the channel even when they did not start from an inbound platform message. Previously only runs triggered by an incoming Slack/Discord/etc. message would render to the channel; heartbeat, Studio, and custom UI runs were silently dropped. The channels output processor now reconstructs the channel destination from the thread itself, so any run on a channel-backed thread delivers its output.
