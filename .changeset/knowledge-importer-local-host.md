---
'@mastra/core': minor
'@mastra/pg': patch
---

Knowledge can now run importers against its own storage (experimental). Pass importer instances as `importers: [...]` to `new Knowledge()`, then call `knowledge.importers.run(bindingId)`. Each instance places one source at a target (`<scope>#<path>`); targets of different instances may overlap or nest.

`createKnowledgeImporterHost(knowledge, { bindings })` returns a host for a service that applies flushes from importers running elsewhere: it runs no importer code, and `bindings` can be a function that's read at each run start, so a host that keeps bindings in its own config needn't be rebuilt when they change. `host.retireBinding(id)` forgets a deleted binding's tracking, cursor and runs, leaving its pages as ordinary pages and its target free for any binding. It also takes `author`, `flushBudgetMs`, `settleBudgetMs` and `staleRunAfterMs`.

With `leaseMs`, that host enforces a strict run lease judged by the store's clock (the database's on Postgres): a heartbeat renews it, and once the lease or the run's deadline passes, heartbeats, new flushes and finishes are refused with `run_not_active` (a flush already waiting is cut off where the lease ends, and an exact resend of a committed flush still gets its receipt). `host.expireRuns()` ends lapsed runs, marked as ended by the host, so a later finish from the importer is refused. `host.requestCancel(runId)` asks a run to stop: its next heartbeat answers `{ cancel: true }` without renewing the lease, and a finish that arrives after the cancel is stored as canceled. `startRun(bindingId, { generation, admit })` refuses a run for an older writer generation, and runs `admit(tx)` inside the start transaction, together with creating the target scope and the run, so a dispatch claim written there commits or rolls back with them.

Each flush is applied in one storage transaction with its importer bookkeeping: items land under their parents (even when the parent arrives later in the same flush), links between items resolve to page links, a removed item that still has children is kept as a stub, and a rerun with unchanged content writes nothing. Importers write where they're configured. A page already at a binding's target becomes its folder, body and children kept; folders are shared, so it stays another binding's folder or item if it was one, and an item page that is another binding's folder is kept as a stub when the item is removed. A page already at an item's path is taken over by that item, whoever wrote it: another binding that imported it stops tracking it, and the body the page had before is kept in a note on the page. A declare keeps the page's body; an upsert supplies or replaces it. An imported page someone moved elsewhere in the same scope stays where they put it and keeps being updated; one moved into another scope is left there and the item is written again at the target. When the item is removed, the page is never deleted and gets that body back. An imported page someone deleted by hand is written again the next time the importer sends its item, and the binding's pages that link to it are updated to wherever it lands. When a binding moves a subtree that holds other bindings' pages, those bindings' links to them are repaired by their next run. A flush of only removals works even when the binding's folder is gone. A flush resent with the same sequence number returns its stored receipt instead of applying twice.

`runKnowledgeImport` is exported for hosts that supply their own `KnowledgeImporterHost`. `importerHostConformance(factory)` returns the protocol cases such a host must pass (sequencing, digests, replay, generations, finish, heartbeat, state) as plain `{ name, run }` objects to register with any test runner. Before it moves or stubs an imported page, the importer locks the pages under it (`KnowledgeStorage.lockSubtree`) so nothing joins or leaves that subtree until commit, and every page under it moves along, whoever wrote it. On Postgres these locks hold until the flush commits, and each flush transaction stops at a deadline (45 seconds, or the run's deadline if sooner) and is resent.

Items that arrive before their parent, or that link to an item not imported yet, are placed under the target and marked unsettled. Later flushes move them under their parent and write their links once the other item exists, a bounded slice at a time (at most 200 items looked at and 50 moves per flush). A flush receipt says `pending: true` while settle work is left; the runner then sends empty flushes until it's done or the run's budget runs out. A run that flushes nothing still sends one empty flush, so settle work an earlier run left gets finished even when the source has nothing new. Settling resumes where the last slice stopped; when it reaches the end it says `pending: true` if pages it skipped past are now waiting, such as linking pages another binding's move queued, so the next slice starts over from the beginning. A run's receipt says `chain: true` when a host should start another run: the importer reported backlog, or settling made progress and still has work. After three settle slices in a row time out, the run stops settling. State keys starting with `mastra:` are reserved for the host.

```ts
const knowledge = new Knowledge({
  storage,
  scopes: { 'docs:$orgId': {} },
  importers: [
    new HelpSpotImporter({
      id: 'helpspot-main',
      target: 'docs:acme#helpspot',
      settings: { baseUrl: 'https://help.example.com' },
      credentials: { apiKey: process.env.HELPSPOT_API_KEY! },
    }),
  ],
});

const result = await knowledge.importers!.run('helpspot-main');
```
