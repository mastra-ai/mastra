---
'@mastra/factory': minor
---

Custom boards can now run your own skills. Pass skills to `new MastraFactory({ skills })`, or add `factory-skills/<name>/SKILL.md` to your app, and name one in a phase's `runner.skill`. Your skill replaces a built-in skill of the same name.

```typescript
import { createSkill } from '@mastra/core/skills';

const releaseNotes = createSkill({
  name: 'release-notes',
  description: 'Draft release notes for a work item',
  instructions: 'Group the release notes by package and end with a one-line summary.',
});

const notesBoard = defineBoard({
  id: 'notes',
  name: 'Notes',
  initialPhase: 'backlog',
  phases: {
    backlog: { name: 'Backlog', kind: 'resting', nextPhases: ['drafting'] },
    drafting: { name: 'Drafting', kind: 'working', runner: { skill: 'release-notes' }, nextPhases: ['published'] },
    published: { name: 'Published', kind: 'terminal' },
  },
});

new MastraFactory({ ...config, boards: [notesBoard], skills: [releaseNotes] });
```

Settings › Skills now lists your app's skills and shows the skill each custom phase runs. The board catalog sends each working phase's `skill`. The constructor warns when a phase names a skill that does not exist, or runs a review skill outside the `review` context.
