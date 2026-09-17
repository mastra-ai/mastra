---
'mastra': minor
---

Added agent version-label management and testing to Studio. Create, move, or delete labels; select Production, Latest, a custom label, or an exact version for a run; and see the immutable version the server actually selected. Production promotion and rollback include stale-change warnings.

```sh
mastra dev
```

Open **Agents → select an agent → Editor → Manage labels**. The **Full configuration** link makes agent names and other configuration screens easier to find. Existing runs remain pinned when labels move; new runs use the updated selection.

Custom labels require supported agent storage. Labels for prompt blocks or skills, persisted historical trace/evaluation provenance, and historical evaluation UI are not included.
