---
'@mastra/core': minor
'@mastra/pg': patch
---

Knowledge can now run importers against its own storage (experimental). Pass importer instances as `importers: [...]` to `new Knowledge()`, then call `knowledge.importers.run(bindingId)`. Each instance places one source at a target (`<scope>#<path>`); instances whose targets nest inside each other are refused.

`createKnowledgeImporterHost(knowledge, { bindings })` returns a host for a service that applies flushes from importers running elsewhere: it runs no importer code, and `bindings` can be a function that's read at each run start, so a host that keeps bindings in its own config needn't be rebuilt when they change. It also takes `author`, `flushBudgetMs`, `settleBudgetMs` and `staleRunAfterMs`.

With `leaseMs`, that host enforces a strict run lease judged by the store's clock (the database's on Postgres): a heartbeat renews it, and once the lease or the run's deadline passes, heartbeats, new flushes and finishes are refused with `run_not_active` (a flush already waiting is cut off where the lease ends, and an exact resend of a committed flush still gets its receipt). `host.expireRuns()` ends lapsed runs, marked as ended by the host, so a later finish from the importer is refused. `host.requestCancel(runId)` asks a run to stop: its next heartbeat answers `{ cancel: true }` without renewing the lease, and a finish that arrives after the cancel is stored as canceled. `startRun(bindingId, { generation, admit })` refuses a run for an older writer generation, and runs `admit(tx)` inside the start transaction, together with creating the target scope and the run, so a dispatch claim written there commits or rolls back with them.

Each flush is applied in one storage transaction with its importer bookkeeping: items land under their parents (even when the parent arrives later in the same flush), links between items resolve to page links, a removed item that still has children is kept as a stub, and a rerun with unchanged content writes nothing. The importer never touches another binding's pages: an item whose path holds another binding's page is refused and the rest of the flush still lands. An imported page someone moved out of the target stays where they put it and keeps being updated, unless it was moved into another scope or inside another binding's pages. A page someone wrote by hand at a binding's target becomes its folder, body and children kept. A page someone wrote by hand at an item's path is taken over by that item, and when the item is removed the page is kept as a stub, never deleted. An imported page someone deleted by hand is written again the next time the importer sends its item, and the binding's pages that link to it are updated to wherever it lands. A flush resent with the same sequence number returns its stored receipt instead of applying twice.

`runKnowledgeImport` is exported for hosts that supply their own `KnowledgeImporterHost`. `importerHostConformance(factory)` returns the protocol cases such a host must pass (sequencing, digests, replay, generations, finish, heartbeat, state) as plain `{ name, run }` objects to register with any test runner. Before it moves or stubs an imported page, the importer locks the pages under it (`KnowledgeStorage.lockSubtree`) and refuses the op if any of them belongs to another binding; pages people added there move along. On Postgres these locks hold until the flush commits, and each flush transaction stops at a deadline (45 seconds, or the run's deadline if sooner) and is resent.

Items that arrive before their parent, or that link to an item not imported yet, are placed under the target and marked unsettled. Later flushes move them under their parent and write their links once the other item exists, a bounded slice at a time (at most 200 items looked at and 50 moves per flush). A flush receipt says `pending: true` while settle work is left; the runner then sends empty flushes until it's done or the run's budget runs out. A run that flushes nothing still sends one empty flush, so settle work an earlier run left gets finished even when the source has nothing new. A run's receipt says `chain: true` when a host should start another run: the importer reported backlog, or settling made progress and still has work. After three settle slices in a row time out, the run stops settling. State keys starting with `mastra:` are reserved for the host.

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
