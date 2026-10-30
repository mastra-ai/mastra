---
'@mastra/platform-workspace': patch
'@mastra/e2b': patch
---

Fixed long-running processes (such as dev servers) dying silently after their timeout passed. The timeout used to cut only the process's output stream, so the process kept running with nothing reading its output and died unreported on its next log line. A process now keeps its output stream for as long as it runs, and is stopped when its timeout runs out, reported like a timeout in a local sandbox: exit code 124, `timedOut: true`, and "Process timed out after …ms" in stderr.
