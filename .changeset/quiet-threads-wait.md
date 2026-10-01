---
'@mastra/code-sdk': patch
---

Fixed Mastra Code starting a second agent run on a thread that was already running in another project's Mastra Code process. Every local Mastra Code process shares one database, so any of them could pick up a notification meant for another project's thread, see that thread as idle, and run it with its own session and workspace.

Mastra Code processes now coordinate a thread's runs no matter which project they belong to, so a busy thread stays busy for every process. Each process delivers the due notifications of its own sessions' resources itself, and only one process delivers a resource's notifications at a time, so a notification is never run by a process that cannot own its thread.
