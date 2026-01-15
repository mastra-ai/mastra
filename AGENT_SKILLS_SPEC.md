# Agent Skills Specification

Mastra's Skills implementation is based on the open [Agent Skills](https://agentskills.io) specification, originally developed by Anthropic and adopted by Claude Code, Cursor, VS Code, GitHub, and others.

## Overview

Agent Skills is a simple, open format for giving agents new capabilities and expertise. Skills are folders of instructions, scripts, and resources that agents can discover and use.

### Key Benefits

- **For Skill Authors**: Build capabilities once, deploy across multiple agent products
- **For Compatible Agents**: Support skills lets users give agents new capabilities out of the box
- **For Teams/Enterprises**: Capture organizational knowledge in portable, version-controlled packages

## Directory Structure

```
skill-name/
├── SKILL.md          # Required: instructions + metadata
├── scripts/          # Optional: executable code
├── references/       # Optional: additional documentation
└── assets/           # Optional: templates, resources
```

## SKILL.md Format

Every skill requires a `SKILL.md` file with YAML frontmatter and Markdown instructions:

```yaml
---
name: pdf-processing
description: Extract text and tables from PDF files, fill forms, merge documents.
license: Apache-2.0
compatibility: Requires git, docker, jq, and access to the internet
metadata:
  author: example-org
  version: "1.0"
allowed-tools: Bash(git:*) Bash(jq:*) Read
---

# PDF Processing

## When to use this skill
Use this skill when the user needs to work with PDF files...

## How to extract text
1. Use pdfplumber for text extraction...
```

## Frontmatter Fields

### Required Fields

| Field         | Constraints                                                                               |
| ------------- | ----------------------------------------------------------------------------------------- |
| `name`        | Max 64 chars. Lowercase letters, numbers, hyphens only. Must match parent directory name. |
| `description` | Max 1024 chars. Describes what skill does and when to use it.                             |

### Optional Fields

| Field           | Description                                                              |
| --------------- | ------------------------------------------------------------------------ |
| `license`       | License name or reference to bundled license file                        |
| `compatibility` | Max 500 chars. Environment requirements (system packages, network, etc.) |
| `metadata`      | Arbitrary key-value mapping for additional metadata                      |
| `allowed-tools` | Space-delimited list of pre-approved tools (experimental)                |

### Name Validation

**Valid:**

- `pdf-processing`
- `data-analysis`
- `code-review`

**Invalid:**

- `PDF-Processing` (uppercase not allowed)
- `-pdf` (cannot start with hyphen)
- `pdf--processing` (consecutive hyphens not allowed)

### Description Guidelines

**Good:**

```yaml
description: Extracts text and tables from PDF files, fills PDF forms, and merges multiple PDFs. Use when working with PDF documents or when the user mentions PDFs, forms, or document extraction.
```

**Poor:**

```yaml
description: Helps with PDFs.
```

## Progressive Disclosure Model

Skills use progressive disclosure to manage context efficiently:

### 1. Discovery (~100 tokens per skill)

At startup, agents load only `name` and `description` of each skill. This minimal metadata tells the agent when a skill might be relevant.

### 2. Activation (<5000 tokens recommended)

When a task matches a skill's description, the agent reads the full `SKILL.md` instructions into context.

### 3. Execution (as needed)

The agent follows instructions, loading referenced files or executing scripts only when required.

```
┌─────────────────────────────────────────────────────────────────┐
│                        STARTUP                                   │
│  Load name + description for all skills (~100 tokens each)      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     USER REQUEST                                 │
│  "Help me extract data from this PDF"                           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      ACTIVATION                                  │
│  Match "PDF" → Load full pdf-processing/SKILL.md                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      EXECUTION                                   │
│  Follow instructions, run scripts/extract.py if needed          │
└─────────────────────────────────────────────────────────────────┘
```

## Optional Directories

### scripts/

Executable code agents can run:

- Should be self-contained or document dependencies
- Include helpful error messages
- Handle edge cases gracefully
- Supported: Python, Bash, JavaScript (varies by agent)

### references/

Additional documentation loaded on demand:

- `REFERENCE.md` - Detailed technical reference
- Domain-specific files (`finance.md`, `legal.md`)
- Keep files focused to reduce context usage

### assets/

Static resources:

- Templates (documents, configurations)
- Images (diagrams, examples)
- Data files (lookup tables, schemas)

## Integration with Mastra

### Skill Discovery

```typescript
const skills = new Skills({
  id: 'my-skills',
  paths: ['./skills'], // Scan for SKILL.md files
});

// Returns parsed metadata for all discovered skills
const allSkills = skills.list();
```

### Agent Integration

```typescript
// Skills registered with Mastra are inherited by agents
const mastra = new Mastra({
  skills,
  agents: { myAgent },
});

// Agent can access skills via getSkills()
const agent = mastra.getAgent('myAgent');
const agentSkills = agent.getSkills();
```

### Context Injection

Skills metadata is injected into agent context:

```xml
<available_skills>
  <skill>
    <name>code-review</name>
    <description>Reviews code for bugs, security issues, and best practices.</description>
    <location>/path/to/skills/code-review/SKILL.md</location>
  </skill>
</available_skills>
```

### Skill Tools

Agents receive tools to interact with skills:

| Tool            | Description                               |
| --------------- | ----------------------------------------- |
| `listSkills`    | List available skills with descriptions   |
| `activateSkill` | Load full skill instructions into context |

## Security Considerations

- **Sandboxing**: Run scripts in isolated environments
- **Allowlisting**: Only execute scripts from trusted skills
- **Confirmation**: Require user approval for dangerous operations
- **Logging**: Audit all script executions

## Best Practices

1. Keep main `SKILL.md` under 500 lines
2. Move detailed reference material to `references/`
3. Use relative paths from skill root for file references
4. Keep file references one level deep
5. Write descriptions with specific keywords for matching

## Resources

- [Agent Skills Specification](https://agentskills.io/specification)
- [Example Skills Repository](https://github.com/anthropics/skills)
- [Reference Library (skills-ref)](https://github.com/agentskills/agentskills/tree/main/skills-ref)

## Related Documents

- [SKILLS_GRAPHS.md](./SKILLS_GRAPHS.md) - Knowledge graph exploration
- [VERSIONING_DESIGN.md](./VERSIONING_DESIGN.md) - Versioning system design
