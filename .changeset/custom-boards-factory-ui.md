---
'@mastra/factory': minor
---

Installed custom boards are now first-class in the Factory UI, and intake routing to them is explicit.

- `GET /web/factory/projects/:id/boards` returns the installed board catalog (IDs, titles, initial phase, ordered phases with `kind` and working `role`, transition topology). Handlers, policies, and prompts are never serialized.
- The UI renders sidebar links, columns, phase labels, working/terminal states, card creation, and card moves from that catalog. Work and Review keep their URLs; custom boards open at `/factories/:id/boards/:boardId`. Unknown boards and catalog failures show an explicit unavailable state instead of falling back to Work. A card's persisted `board` determines membership; UI actions cannot reassign it. Settings › Skills groups built-in skills by board and lists custom boards' declared roles.
- Intake bindings are explicit: a Linear project or GitHub repository feeds a board only once bound to one, and opening a board no longer materializes cards. `intake_source_bindings` gains a `board` column; rebinding a Linear project moves its non-terminal, idle cards to the new board's initial phase.
- GitHub label routing: `GET`/`PUT /web/intake/label-routes` map a label to a board per Factory project (new `intake_label_routes` table). `issueOpened` picks the routed board, saving a route relocates matching cards, and `issues.labeled` / `issues.unlabeled` move cards between the routed board and Work while refreshing label metadata. Unrouted issues still go to Work.

Install a board and it shows up in the UI; route intake to it from Settings › Intake:

```ts
import { MastraFactory, defineBoard } from '@mastra/factory';

const release = defineBoard({
  id: 'release',
  title: 'Release',
  initialPhase: 'queued',
  phases: {
    queued: { title: 'Queued', kind: 'resting', next: 'shipping' },
    shipping: { title: 'Shipping', kind: 'working', role: 'release-publisher', next: 'shipped' },
    shipped: { title: 'Shipped', kind: 'terminal' },
  },
});

new MastraFactory({ storage, boards: [release] });
```

Then in Settings › Intake, bind a Linear project to **Release**, or add a GitHub label route such as `release → Release`. `mastra api factory boards <project-id>` lists what a project has installed.
