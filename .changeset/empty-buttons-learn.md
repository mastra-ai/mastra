---
'@mastra/code-sdk': patch
---

Fixed dataset experiments run over HTTP against the Mastra Code agent failing with "getState is not a function". A JSON `controller` snapshot with the selected model now runs the agent in an experiment-local session using the server's own project folder.
