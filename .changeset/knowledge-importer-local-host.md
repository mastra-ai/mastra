---
'@mastra/core': minor
'@mastra/pg': patch
---

Knowledge can now run importers against its own storage (experimental). Pass `importers: { definitions, bindings }` to `new Knowledge()`, then call `knowledge.importers.run(bindingId)`. Each binding places one importer at a target (`<scope>#<path>`); bindings whose targets nest inside each other are refused.

Each flush is applied in one storage transaction with its importer bookkeeping: items land under their parents (even when the parent arrives later in the same flush), links between items resolve to page links, a removed item that still has children is kept as a stub, and a rerun with unchanged content writes nothing. The importer only touches pages it created: a page someone else holds at an item's path, or an imported page someone moved out of the target, is refused and the rest of the flush still lands. A flush resent with the same sequence number returns its stored receipt instead of applying twice.

`runKnowledgeImport` is exported for hosts that supply their own `KnowledgeImporterHost`. `importerHostConformance(factory)` returns the protocol cases such a host must pass (sequencing, digests, replay, generations, finish, heartbeat, state) as plain `{ name, run }` objects to register with any test runner. Before it moves or stubs an imported page, the importer locks the pages under it (`KnowledgeStorage.lockSubtree`) and refuses the op if any of them belongs to another binding; pages people added there move along. On Postgres these locks hold until the flush commits, and each flush transaction stops at a deadline (45 seconds, or the run's deadline if sooner) and is resent.

Items that arrive before their parent, or that link to an item not imported yet, are placed under the target and marked unsettled. Later flushes move them under their parent and write their links once the other item exists, a bounded slice at a time (at most 200 items looked at and 50 moves per flush). A flush receipt says `pending: true` while settle work is left; the runner then sends empty flushes until it's done or the run's budget runs out. A run that flushes nothing still sends one empty flush, so settle work an earlier run left gets finished even when the source has nothing new. A run's receipt says `chain: true` when a host should start another run: the importer reported backlog, or settling made progress and still has work. After three settle slices in a row time out, the run stops settling. State keys starting with `mastra:` are reserved for the host.

```ts
const knowledge = new Knowledge({
  storage,
  scopes: { 'docs:$orgId': {} },
  importers: {
    definitions: [helpspot],
    bindings: [
      {
        id: 'helpspot-main',
        importer: 'helpspot',
        target: 'docs:acme#helpspot',
        settings: { baseUrl: 'https://help.example.com' },
        credentials: { apiKey: process.env.HELPSPOT_API_KEY! },
      },
    ],
  },
});

const result = await knowledge.importers!.run('helpspot-main');
```
