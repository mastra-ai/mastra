---
'mastra': patch
---

Fixed `create-mastra` appearing to freeze when enabling Mastra platform observability. Template clone and dependency install still run in the background during platform sign-in, but once sign-in finishes the CLI now shows a spinner until the install completes instead of going silent.
