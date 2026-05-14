### 5.1a Thread, Session, and Display Records

This group is the durable identity layer of a live conversation. It owns three
record shapes that together describe a single active `(harnessName,
resourceId, threadId)` tuple:

- `HarnessThread` — the conversation row that scopes the persisted message log
  and carries public application metadata.
- `SessionRecord` — the durable runtime row joined to that thread under the
  active-key tuple, guarded by the §5.8 lease and version CAS, and composing
  in-flight pending work plus per-session state slots.
- `HarnessDisplayStateSnapshotV1` — the JSON-safe debounced render projection
  stored on `SessionRecord.displayState` and returned by `getDisplayState`.

Field declarations live in the child files below; this page is the cross-child
reader map only.

- `02-thread-and-session-records.md` declares `HarnessThread`,
  `ThreadMetadata`, `ThreadCloneMetadata`, and `SessionRecord`, and contains
  the §5.1a record-relationship diagram.
- `03-display-records.md` declares `HarnessDisplayStateSnapshotV1` and its
  nested snapshot shapes, plus the canonical display projection / rebuild
  table used after hydration.
