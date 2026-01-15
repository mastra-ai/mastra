# Skills Versioning Design

Design document for skill versioning and update management.

## Current State

Skills currently have a simple `version` field in frontmatter metadata:

```yaml
---
name: code-review
metadata:
  version: '1.0'
---
```

This version is metadata-only with no enforcement or update mechanics.

## Simple Versioning Approach (Phase 1)

The initial versioning implementation uses a straightforward archive-based approach.

### Archive Structure

Old versions are saved in a `.versions/` directory within each skill:

```
skills/
└── code-review/
    ├── SKILL.md              # Current version (1.2.0)
    └── .versions/
        ├── 1.0.0/
        │   └── SKILL.md      # Archived v1.0.0
        └── 1.1.0/
            └── SKILL.md      # Archived v1.1.0
```

### Version Operations

#### Save Current Version

Before updating a skill, archive the current version:

```typescript
async function archiveCurrentVersion(skillPath: string): Promise<void> {
  const skill = await parseSkillMetadata(skillPath);
  const version = skill.metadata?.version || '1.0.0';

  const archivePath = join(skillPath, '.versions', version);
  await mkdir(archivePath, { recursive: true });

  // Copy current SKILL.md to archive
  await copyFile(join(skillPath, 'SKILL.md'), join(archivePath, 'SKILL.md'));

  // Optionally copy scripts/, references/, assets/
}
```

#### List Versions

```typescript
async function listVersions(skillPath: string): Promise<string[]> {
  const versionsPath = join(skillPath, '.versions');

  if (!existsSync(versionsPath)) {
    return [];
  }

  const entries = await readdir(versionsPath, { withFileTypes: true });
  return entries
    .filter(e => e.isDirectory())
    .map(e => e.name)
    .sort(semverCompare);
}
```

#### Restore Version

```typescript
async function restoreVersion(skillPath: string, version: string): Promise<void> {
  const archivePath = join(skillPath, '.versions', version);

  if (!existsSync(archivePath)) {
    throw new Error(`Version ${version} not found`);
  }

  // Archive current version first
  await archiveCurrentVersion(skillPath);

  // Restore archived version
  await copyFile(join(archivePath, 'SKILL.md'), join(skillPath, 'SKILL.md'));
}
```

### Advantages

- Simple to implement and understand
- No external dependencies
- Works with any filesystem
- Easy to inspect and debug
- Versions are self-contained snapshots

### Limitations

- Storage grows linearly with versions
- No diff/patch capabilities
- No branching or merging
- Manual version management required

## Git-Like Versioning (Future Exploration)

For more advanced versioning needs, we could leverage Git-like mechanics.

### Concept

Use Git as the underlying version control system, either:

1. **Embedded libgit2**: Direct Git operations via library
2. **Git CLI**: Shell out to `git` commands
3. **Custom implementation**: Git-inspired content-addressable storage

### Potential Structure

```
skills/
└── .skills-repo/           # Git repository for all skills
    ├── .git/               # Git internals
    └── skills/
        ├── code-review/
        │   └── SKILL.md
        └── api-design/
            └── SKILL.md
```

### Git-Based Operations

#### Version a Skill

```typescript
async function commitSkillVersion(skillName: string, message: string): Promise<string> {
  // Stage changes
  await git.add(`skills/${skillName}/*`);

  // Create commit
  const commit = await git.commit(message);

  // Tag with version
  const version = await getNextVersion(skillName);
  await git.tag(`${skillName}-v${version}`, commit);

  return version;
}
```

#### View History

```typescript
async function getSkillHistory(skillName: string): Promise<VersionInfo[]> {
  const logs = await git.log({
    path: `skills/${skillName}`,
    maxCount: 50,
  });

  return logs.map(log => ({
    version: extractVersionFromTag(log),
    message: log.message,
    date: log.date,
    hash: log.hash,
  }));
}
```

#### Diff Versions

```typescript
async function diffVersions(skillName: string, fromVersion: string, toVersion: string): Promise<string> {
  return git.diff(`${skillName}-v${fromVersion}`, `${skillName}-v${toVersion}`, `skills/${skillName}`);
}
```

### Advanced Features (Git-Based)

| Feature         | Description                            |
| --------------- | -------------------------------------- |
| **Branching**   | Experimental skill variants            |
| **Merging**     | Combine changes from branches          |
| **Cherry-pick** | Apply specific changes across versions |
| **Bisect**      | Find when a regression was introduced  |
| **Blame**       | Track who changed what                 |
| **Hooks**       | Validate skills before commit          |

### Trade-offs

| Aspect             | Simple Archive | Git-Based    |
| ------------------ | -------------- | ------------ |
| Complexity         | Low            | High         |
| Dependencies       | None           | Git/libgit2  |
| Storage efficiency | Low            | High (dedup) |
| Diff support       | No             | Yes          |
| Branching          | No             | Yes          |
| Learning curve     | Minimal        | Moderate     |
| Portability        | High           | Depends      |

## Version Constraints

Both approaches can support version constraints for agents:

```typescript
const agent = new Agent({
  skills: new Skills({
    paths: ['./skills'],
    constraints: {
      'code-review': '^1.0.0', // Any 1.x.x
      'api-design': '~2.1.0', // 2.1.x only
      security: '3.0.0', // Exact version
    },
  }),
});
```

### Constraint Resolution

```typescript
function resolveVersion(available: string[], constraint: string): string | null {
  // Sort versions descending
  const sorted = available.sort(semverCompare).reverse();

  // Find first matching version
  return sorted.find(v => semver.satisfies(v, constraint)) || null;
}
```

## API Design

### Skills Class Extensions

```typescript
class Skills {
  // List available versions for a skill
  listVersions(skillName: string): Promise<string[]>;

  // Get a specific version
  getVersion(skillName: string, version: string): Promise<SkillMetadata>;

  // Archive current and update
  updateSkill(skillName: string, newContent: string): Promise<string>;

  // Restore a previous version
  restoreVersion(skillName: string, version: string): Promise<void>;

  // Compare versions
  diffVersions(skillName: string, from: string, to: string): Promise<VersionDiff>;
}
```

### UI Considerations

- Version dropdown in skill detail view
- "History" tab showing version timeline
- Diff viewer for comparing versions
- "Restore" button with confirmation
- Version badge showing current version

## Implementation Phases

### Phase 1: Simple Archive (Current Focus)

- `.versions/` directory structure
- Archive before update
- List and restore versions
- Basic version metadata

### Phase 2: Version Constraints

- Constraint syntax (^, ~, exact)
- Constraint validation
- Filtered skill listing
- Lock file generation

### Phase 3: Git Exploration (Future)

- Evaluate Git integration options
- Prototype with libgit2 or CLI
- Measure performance and complexity
- Decide go/no-go based on findings

## Open Questions

1. **Auto-versioning**: Should we auto-increment versions on save?
2. **Version retention**: How many versions to keep? Prune old ones?
3. **Cross-skill versions**: Version skills individually or as a collection?
4. **Migration**: How to migrate from archive to Git-based?
5. **Conflict resolution**: What if restored version conflicts with current state?

## Related Documents

- [AGENT_SKILLS_SPEC.md](./AGENT_SKILLS_SPEC.md) - Agent Skills specification
- [SKILLS_GRAPHS.md](./SKILLS_GRAPHS.md) - Knowledge graph exploration
