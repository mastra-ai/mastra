# Workspace Tests Plan

Test coverage plan for the unified Workspace system.

Based on PR #11515 tests and current implementation gaps.

**Status: COMPLETED** - All planned unit tests have been implemented.

---

## Current Test Coverage

| File                                                          | Status     | Tests | Notes                                  |
| ------------------------------------------------------------- | ---------- | ----- | -------------------------------------- |
| `packages/core/src/workspace/bm25.test.ts`                    | ✅ Exists  | -     | BM25 search algorithm                  |
| `packages/core/src/workspace/search-engine.test.ts`           | ✅ Exists  | -     | Search engine (BM25 + vector + hybrid) |
| `packages/core/src/workspace/skills/workspace-skills.test.ts` | ✅ Created | 39    | WorkspaceSkills discovery & management |
| `packages/core/src/workspace/skills/schemas.test.ts`          | ✅ Created | 68    | Skill validation schemas               |
| `packages/core/src/processors/processors/skills.test.ts`      | ✅ Created | 30    | SkillsProcessor for agent context      |
| `packages/core/src/workspace/workspace.test.ts`               | ✅ Created | 50    | Workspace class                        |
| `packages/core/src/workspace/local-filesystem.test.ts`        | ✅ Created | 69    | LocalFilesystem provider               |
| `packages/core/src/workspace/local-sandbox.test.ts`           | ✅ Created | 36    | LocalSandbox provider                  |
| `packages/core/src/workspace/tools.test.ts`                   | ✅ Created | 28    | createWorkspaceTools function          |
| `packages/server/src/server/handlers/workspace.test.ts`       | ✅ Created | 34    | Server route handlers                  |
| `client-sdks/client-js/src/resources/workspace.test.ts`       | ✅ Created | 29    | Client SDK Workspace resource          |

**Total new tests: 383**

---

## Tests Implemented

### 1. Core Package (`packages/core`)

#### 1.1 Workspace Class (`workspace.test.ts`) ✅

**Source:** `packages/core/src/workspace/workspace.ts`

Tests implemented (50 tests):

- [x] Workspace initialization with different configs
- [x] File operations delegation to filesystem
- [x] Search operations (index, search, rebuildIndex)
- [x] Sandbox operations delegation
- [x] Capability flags (`canBM25`, `canVector`, `canHybrid`)
- [x] Skills accessor (`workspace.skills`)
- [x] Error handling for missing providers
- [x] State storage (FilesystemState)

#### 1.2 WorkspaceSkills (`workspace-skills.test.ts`) ✅

**Source:** `packages/core/src/workspace/skills/workspace-skills.ts`

Tests implemented (39 tests):

- [x] `list()` - List all skills from skillsPaths
- [x] `get(name)` - Get specific skill by name
- [x] `has(name)` - Check if skill exists
- [x] `refresh()` - Re-scan skillsPaths
- [x] `search(query)` - Search skills by content
- [x] `getReference(skillName, path)` - Get reference file content
- [x] `getScript(skillName, path)` - Get script file content
- [x] `getAsset(skillName, path)` - Get asset file content
- [x] `listReferences(skillName)` - List all references for a skill
- [x] `listScripts(skillName)` - List all scripts for a skill
- [x] `listAssets(skillName)` - List all assets for a skill
- [x] SKILL.md parsing (frontmatter + instructions)
- [x] Skill validation against schema
- [x] Directory name must match skill name
- [x] Multiple skillsPaths resolution

#### 1.3 Skills Schema Validation (`schemas.test.ts`) ✅

**Source:** `packages/core/src/workspace/skills/schemas.ts`

Tests implemented (68 tests):

- [x] `SkillNameSchema` validation (length, characters, no consecutive hyphens)
- [x] `SkillDescriptionSchema` validation
- [x] `SkillMetadataSchema` full validation
- [x] `validateSkillMetadata()` function
- [x] `parseAllowedTools()` function
- [x] Token/line warnings for instructions

#### 1.4 LocalFilesystem (`local-filesystem.test.ts`) ✅

**Source:** `packages/core/src/workspace/local-filesystem.ts`

Tests implemented (69 tests):

- [x] `readFile()` with different encodings
- [x] `writeFile()` with overwrite options
- [x] `readdir()` recursive and non-recursive
- [x] `exists()` for files and directories
- [x] `mkdir()` recursive creation
- [x] `deleteFile()` with force option
- [x] `stat()` file metadata
- [x] `isFile()` / `isDirectory()` checks
- [x] Path resolution and normalization
- [x] Error handling for missing files
- [x] Sandbox mode path restrictions
- [x] MIME type detection

#### 1.5 LocalSandbox (`local-sandbox.test.ts`) ✅

**Source:** `packages/core/src/workspace/local-sandbox.ts`

Tests implemented (36 tests):

- [x] `executeCode()` with different runtimes (node, python, bash)
- [x] `executeCommand()` with args
- [x] Timeout handling
- [x] Exit code handling
- [x] stdout/stderr capture
- [x] Working directory option
- [x] Environment variables
- [x] Lifecycle (start, stop, destroy)

#### 1.6 Workspace Tools (`tools.test.ts`) ✅

**Source:** `packages/core/src/workspace/tools.ts`

Tests implemented (28 tests):

- [x] `createWorkspaceTools()` returns correct tools based on capabilities
- [x] `workspace_read_file` tool execution
- [x] `workspace_write_file` tool execution
- [x] `workspace_list_files` tool execution
- [x] `workspace_delete_file` tool execution
- [x] `workspace_file_exists` tool execution
- [x] `workspace_mkdir` tool execution
- [x] `workspace_search` tool execution (when search available)
- [x] `workspace_index` tool execution
- [x] `workspace_execute_code` tool execution (when sandbox available)
- [x] `workspace_execute_command` tool execution
- [x] `workspace_install_package` tool execution

#### 1.7 SkillsProcessor (`processors/processors/skills.test.ts`) ✅

**Source:** `packages/core/src/processors/processors/skills.ts`

Tests implemented (30 tests):

- [x] `processInputStep()` - Skills injection into system message
- [x] XML format generation
- [x] Markdown format generation
- [x] Tool injection (`skill_read_reference`, `skill_read_script`, etc.)
- [x] Skill search tool
- [x] Tool execution for reading skill content
- [x] Allowed tools aggregation
- [x] Integration with agent context

---

### 2. Server Package (`packages/server`)

#### 2.1 Workspace Handlers (`handlers/workspace.test.ts`) ✅

**Source:** `packages/server/src/server/handlers/workspace.ts`

Tests implemented (34 tests):

- [x] `GET /api/workspace` - Get workspace info
- [x] `GET /api/workspace/fs/read` - Read file
- [x] `POST /api/workspace/fs/write` - Write file
- [x] `DELETE /api/workspace/fs/delete` - Delete file
- [x] `GET /api/workspace/fs/list` - List files
- [x] `POST /api/workspace/fs/mkdir` - Create directory
- [x] `GET /api/workspace/fs/stat` - Get file stats
- [x] `GET /api/workspace/search` - Search content
- [x] `POST /api/workspace/index` - Index content
- [x] `DELETE /api/workspace/unindex` - Unindex content
- [x] `GET /api/workspace/skills` - List skills
- [x] `GET /api/workspace/skills/:skillName` - Get skill details
- [x] `GET /api/workspace/skills/search` - Search skills
- [x] `GET /api/workspace/skills/:skillName/references` - List references
- [x] `GET /api/workspace/skills/:skillName/references/:path` - Get reference
- [x] Error responses for unconfigured workspace
- [x] HTTPException handling

---

### 3. Client SDK (`client-sdks/client-js`)

#### 3.1 Workspace Resource (`resources/workspace.test.ts`) ✅

**Source:** `client-sdks/client-js/src/resources/workspace.ts`

Tests implemented (29 tests):

- [x] `info()` - Get workspace info
- [x] `readFile(path)` - Read file content
- [x] `writeFile(path, content)` - Write file
- [x] `listFiles(path)` - List directory
- [x] `delete(path)` - Delete file
- [x] `mkdir(path)` - Create directory
- [x] `stat(path)` - Get file stats
- [x] `search(query)` - Search content
- [x] `index(path, content)` - Index content
- [x] `unindex(path)` - Unindex content
- [x] `listSkills()` - List available skills
- [x] `getSkill(name)` - Get skill resource
- [x] `searchSkills(query)` - Search skills
- [x] `WorkspaceSkillResource.details()` - Get skill details
- [x] `WorkspaceSkillResource.listReferences()` - List references
- [x] `WorkspaceSkillResource.getReference(path)` - Get reference content
- [x] URL encoding for special characters

---

### 4. Integration Tests (Future)

#### 4.1 Agent + Workspace Integration

Tests needed (future):

- [ ] Agent with workspace auto-injects tools
- [ ] SkillsProcessor auto-added when skillsPaths configured
- [ ] Skills available in agent context
- [ ] Workspace tools callable by agent

#### 4.2 E2E Playground Tests

Tests needed (future):

- [ ] Workspace panel displays correctly
- [ ] File browser operations work
- [ ] Skills list displays
- [ ] Skill details accessible

---

## Files Reference from PR #11515

| PR File                                             | Maps To                                     | Status             |
| --------------------------------------------------- | ------------------------------------------- | ------------------ |
| `packages/skills/src/skills.test.ts`                | `workspace/skills/workspace-skills.test.ts` | ✅                 |
| `packages/skills/src/processors/skills.test.ts`     | `processors/processors/skills.test.ts`      | ✅                 |
| `packages/skills/src/storage/filesystem.test.ts`    | `workspace/local-filesystem.test.ts`        | ✅                 |
| `packages/skills/src/bm25.test.ts`                  | `workspace/bm25.test.ts`                    | ✅ Already existed |
| `packages/skills/src/search-engine.test.ts`         | `workspace/search-engine.test.ts`           | ✅ Already existed |
| `packages/skills/src/knowledge.test.ts`             | `workspace/workspace.test.ts`               | ✅                 |
| `packages/skills/src/knowledge-integration.test.ts` | Integration tests                           | ⏳ Future          |
| `packages/skills/src/agent-examples.test.ts`        | Agent integration tests                     | ⏳ Future          |
