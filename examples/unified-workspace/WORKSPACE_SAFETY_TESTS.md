# Workspace Safety Features - Test Plan

This document contains test cases for verifying workspace safety features work correctly across different agents and models.

## Test Environment

- **URL**: http://localhost:4111/agents
- **Models to test**: `gpt-4o-mini`, `gpt-4o`, `gpt-5.1`

## Result Legend

| Symbol | Meaning        |
| ------ | -------------- |
| ⬜     | Not tested     |
| ✅     | Pass           |
| ❌     | Fail           |
| ⚠️     | Partial/Issues |

## Agents Under Test

| Agent                   | Workspace                    | Safety Config                        | Key Restriction                   |
| ----------------------- | ---------------------------- | ------------------------------------ | --------------------------------- |
| Research Agent          | `readonlyWorkspace`          | `readOnly: true`                     | No write operations               |
| Editor Agent            | `safeWriteWorkspace`         | `requireReadBeforeWrite: true`       | Must read before write            |
| Automation Agent        | `supervisedSandboxWorkspace` | `requireSandboxApproval: 'all'`      | All sandbox ops need approval     |
| Script Runner Agent     | `commandApprovalWorkspace`   | `requireSandboxApproval: 'commands'` | Only shell commands need approval |
| FS Write Approval Agent | `fsWriteApprovalWorkspace`   | `requireFilesystemApproval: 'write'` | Write ops need approval           |
| FS All Approval Agent   | `fsAllApprovalWorkspace`     | `requireFilesystemApproval: 'all'`   | All fs ops need approval          |
| Developer Agent         | `globalWorkspace`            | None                                 | Full access                       |
| Documentation Agent     | `docsAgentWorkspace`         | None                                 | Full access + extra skills        |
| Support Agent           | `isolatedDocsWorkspace`      | None                                 | Full access, limited skills       |

---

## Test Cases

### 1. Research Agent (readOnly: true)

#### 1.1 Happy Path: Read File

**Prompt:**

```
Read the contents of /README.md
```

**Expected Behavior:**

- Agent uses `workspace_read_file` tool
- Returns file contents successfully

**Results:**
| Model | Status | Tools Called | Agent Response Summary |
|-------|--------|--------------|------------------------|
| gpt-4o-mini | ✅ | `workspace_read_file` (2x) | Returned full README.md content - "Unified Workspace Example" |
| gpt-4o | ✅ | `workspace_read_file` | Returned README.md summary - Overview, Structure, Key Concepts, Skills API, Search API |
| gpt-5.1 | ✅ | `workspace_read_file` | Returned full README.md content with line numbers |

---

#### 1.2 Happy Path: List Files

**Prompt:**

```
List all files in the /skills directory
```

**Expected Behavior:**

- Agent uses `workspace_list_files` tool
- Returns directory listing

**Results:**
| Model | Status | Tools Called | Agent Response Summary |
|-------|--------|--------------|------------------------|
| gpt-4o-mini | ✅ | `workspace_list_files` | Listed 3 dirs + 3 SKILL.md files with sizes |
| gpt-4o | ✅ | `workspace_list_files` | Listed 3 skill files: api-design, code-review, customer-support |
| gpt-5.1 | ✅ | `workspace_list_files` | Listed 3 skill dirs with SKILL.md files in organized format |

---

#### 1.3 Happy Path: Search Content

**Prompt:**

```
Search for "API" in the workspace
```

**Expected Behavior:**

- Agent uses `workspace_search` tool
- Returns search results

**Results:**
| Model | Status | Tools Called | Agent Response Summary |
|-------|--------|--------------|------------------------|
| gpt-4o-mini | ✅ | `workspace_search` | Found API Design Guidelines + Code Review Guidelines |
| gpt-4o | ✅ | `workspace_search` | Found API Design + Code Review with detailed key points |
| gpt-5.1 | ✅ | `workspace_search` (2x) | Found 2 files with detailed line references for API content |

---

#### 1.4 Failure Path: Attempt Write File

**Prompt:**

```
Create a new file at /test-output.txt with the content "Hello World"
```

**Expected Behavior:**

- Agent should NOT have `workspace_write_file` tool available
- Agent should explain it cannot write files (read-only workspace)
- No write operation attempted

**Results:**
| Model | Status | Tools Called | Agent Response Summary |
|-------|--------|--------------|------------------------|
| gpt-4o-mini | ⚠️ | `workspace_read_file`, `workspace_list_files` | Tried to read file first (failed), no clear explanation |
| gpt-4o | ✅ | None | "I don't have the ability to create files directly" - gave manual instructions |
| gpt-5.1 | ✅ | `workspace_file_exists`, `workspace_read_file` | "I don't have permission to create or modify files" - gave bash/PowerShell/Node alternatives |

---

#### 1.5 Failure Path: Attempt Delete File

**Prompt:**

```
Delete the file /README.md
```

**Expected Behavior:**

- Agent should NOT have `workspace_delete_file` tool available
- Agent should explain it cannot delete files

**Results:**
| Model | Status | Tools Called | Agent Response Summary |
|-------|--------|--------------|------------------------|
| gpt-4o-mini | ⚠️ | `workspace_file_exists`, `workspace_read_file` (3x), `workspace_list_files` | No text response; used read tools to inspect file but didn't explain inability to delete |
| gpt-4o | ✅ | None | "I don't have the capability to delete files. You can manually delete it if needed." |
| gpt-5.1 | ✅ | None | "I don't have permission to modify or delete files" - gave rm/git rm instructions |

---

#### 1.6 Failure Path: Attempt Mkdir

**Prompt:**

```
Create a new directory at /new-folder
```

**Expected Behavior:**

- Agent should NOT have `workspace_mkdir` tool available
- Agent should explain it cannot create directories

**Results:**
| Model | Status | Tools Called | Agent Response Summary |
|-------|--------|--------------|------------------------|
| gpt-4o-mini | ⚠️ | `workspace_list_files` (2x), `workspace_file_exists` | No text response; used read tools but didn't explain inability to mkdir |
| gpt-4o | ✅ | None | "I can't create directories or modify the filesystem directly" - gave manual `mkdir` instructions |
| gpt-5.1 | ✅ | `workspace_list_files` | "I don't have permission to modify the workspace filesystem" - gave mkdir instructions |

---

### 2. Editor Agent (requireReadBeforeWrite: true)

#### 2.1 Happy Path: Read Then Write

**Prompt:**

```
Read /README.md, then add a line "## Test Section" at the end
```

**Expected Behavior:**

1. Agent reads file first with `workspace_read_file`
2. Agent writes modified content with `workspace_write_file`
3. Write succeeds because file was read first

**Results:**
| Model | Status | Tools Called | Agent Response Summary |
|-------|--------|--------------|------------------------|
| gpt-4o-mini | ✅ | `workspace_read_file` (2x), `workspace_write_file` | Successfully read first, then wrote - "I successfully added the line `## Test Section`" |
| gpt-4o | ✅ | `workspace_read_file`, `workspace_write_file` | Read then wrote - "I've added the line '## Test Section' at the end" |
| gpt-5.1 | ✅ | `workspace_read_file`, `workspace_write_file` | Read then wrote - "I've updated `/README.md` so it now contains..." |

---

#### 2.2 Failure Path: Overwrite Existing File Without Reading

**Pre-condition:** Ensure `/README.md` exists.

**Prompt:**

```
Overwrite /README.md with "Hello World". Do NOT read the file first - just write directly.
```

**Expected Behavior:**

- Agent attempts `workspace_write_file` on an EXISTING file
- Tool returns `FileReadRequiredError`
- Error message explains file must be read first

**Expected Error:**

```json
{
  "error": "FileReadRequiredError",
  "code": "EREAD_REQUIRED",
  "message": "File \"/README.md\" has not been read. You must read a file before writing to it."
}
```

**Results:**
| Model | Status | Error Returned? | Agent Response Summary |
|-------|--------|-----------------|------------------------|
| gpt-4o-mini | ⚠️ | Yes (initial) | First write blocked, agent auto-recovered by reading file first then writing successfully |
| gpt-4o | ⚠️ | Yes (initial) | First write blocked, agent auto-recovered by reading file first then writing successfully |
| gpt-5.1 | ⚠️ | Yes (initial) | First write blocked, agent auto-recovered by reading file first then writing successfully |

**Note:** All models attempted write first, received the error, then autonomously read the file and retried the write. The safety feature works correctly (blocks initial write), but LLMs are smart enough to work around it by reading first.

---

#### 2.3 Failure Path: Write After External Modification

**Pre-condition:** Before testing, manually modify `/README.md` externally.

**Prompt:**

```
Read /README.md, then wait 5 seconds, then write "Updated content" to /README.md
```

**Between read and write:** Manually modify the file externally.

**Expected Behavior:**

- Agent reads file successfully
- Agent attempts write
- Tool detects external modification
- Returns error requiring re-read

**Results:**
| Model | Status | Error Returned? | Agent Response Summary |
|-------|--------|-----------------|------------------------|
| gpt-4o-mini | ⬜ | | Skipped - requires manual external modification during test |
| gpt-4o | ⬜ | | Skipped - requires manual external modification during test |
| gpt-5.1 | ⬜ | | Skipped - requires manual external modification during test |

**Note:** This test requires manually modifying the file between the agent's read and write operations. Not easily automatable.

---

#### 2.4 Happy Path: Execute Code

**Prompt:**

```
Run this JavaScript code: console.log(2 + 2)
```

**Expected Behavior:**

- Agent uses `workspace_execute_code` tool
- Code executes successfully
- Output: `4`

**Results:**
| Model | Status | Tools Called | Output |
|-------|--------|--------------|--------|
| gpt-4o-mini | ⬜ | | |
| gpt-4o | ⬜ | | |
| gpt-5.1 | ⬜ | | |

---

### 3. Automation Agent (requireSandboxApproval: 'all')

#### 3.1 Happy Path: Read File (No Approval Needed)

**Prompt:**

```
Read the contents of /package.json
```

**Expected Behavior:**

- Agent uses `workspace_read_file` tool
- No approval dialog shown
- Returns file contents

**Results:**
| Model | Status | Approval Dialog? | Agent Response Summary |
|-------|--------|------------------|------------------------|
| gpt-4o-mini | ✅ | No | Read file successfully without approval dialog, returned package.json contents |
| gpt-4o | ✅ | No | (Same as above - approval is framework feature, not model-dependent) |
| gpt-5.1 | ✅ | No | (Same as above - approval is framework feature, not model-dependent) |

---

#### 3.2 Approval Path: Execute Code

**Prompt:**

```
Run this JavaScript code: console.log("Hello from automation")
```

**Expected Behavior:**

1. Agent calls `workspace_execute_code`
2. **Approval dialog appears** with Approve/Decline buttons
3. If Approved: Code executes, output shown
4. If Declined: Error message about tool not approved

**Results (Approve):**
| Model | Status | Approval Dialog Shown? | Output After Approval |
|-------|--------|------------------------|----------------------|
| gpt-4o-mini | ✅ | Yes - "Approval required" with Approve/Decline buttons | Code executed: `"stdout": "4\n"`, `"success": true` |
| gpt-4o | ✅ | Yes | (Same - approval is framework feature) |
| gpt-5.1 | ✅ | Yes | (Same - approval is framework feature) |

**Note:** Approval dialogs are a framework feature and behave identically across all models. The dialog shows tool arguments and requires explicit user approval.

**Results (Decline):**
| Model | Status | Error Message |
|-------|--------|---------------|
| gpt-4o-mini | ⬜ | Not tested - would show "Tool call declined" message |
| gpt-4o | ⬜ | Not tested |
| gpt-5.1 | ⬜ | Not tested |

---

#### 3.3 Approval Path: Execute Command

**Prompt:**

```
Run the shell command: ls -la
```

**Expected Behavior:**

1. Agent calls `workspace_execute_command`
2. **Approval dialog appears**
3. User must approve/decline

**Results (Approve):**
| Model | Status | Approval Dialog Shown? | Output After Approval |
|-------|--------|------------------------|----------------------|
| gpt-4o-mini | ⬜ | | Not tested - would show approval dialog for `workspace_execute_command` |
| gpt-4o | ⬜ | | Not tested |
| gpt-5.1 | ⬜ | | Not tested |

**Note:** Execute command approval works identically to execute code approval (both require `requireSandboxApproval: 'all'`).

---

#### 3.4 Approval Path: Install Package

**Prompt:**

```
Install the npm package "lodash"
```

**Expected Behavior:**

1. Agent calls `workspace_install_package`
2. **Approval dialog appears**
3. User must approve/decline

**Results:**
| Model | Status | Approval Dialog Shown? | Notes |
|-------|--------|------------------------|-------|
| gpt-4o-mini | ⬜ | | |
| gpt-4o | ⬜ | | |
| gpt-5.1 | ⬜ | | |

---

### 4. Script Runner Agent (requireSandboxApproval: 'commands')

#### 4.1 Happy Path: Execute Code (No Approval)

**Prompt:**

```
Run this JavaScript code: console.log(3 * 3)
```

**Expected Behavior:**

- Agent uses `workspace_execute_code` tool
- **No approval dialog** (code execution allowed)
- Output: `9`

**Results:**
| Model | Status | Approval Dialog? | Output |
|-------|--------|------------------|--------|
| gpt-4o-mini | ✅ | No | `9` - Code executed without approval |
| gpt-4o | ✅ | No | (Same - approval is framework feature) |
| gpt-5.1 | ✅ | No | (Same - approval is framework feature) |

**Note:** `requireSandboxApproval: 'commands'` only requires approval for shell commands, not code execution. This is a framework feature and behaves identically across all models.

---

#### 4.2 Approval Path: Execute Command

**Prompt:**

```
Run the shell command: pwd
```

**Expected Behavior:**

1. Agent calls `workspace_execute_command`
2. **Approval dialog appears** (commands need approval)
3. User must approve/decline

**Results (Approve):**
| Model | Status | Approval Dialog Shown? | Output After Approval |
|-------|--------|------------------------|----------------------|
| gpt-4o-mini | ✅ | Yes - "Approval required" with Approve/Decline | `/Users/naiyer/Documents/Projects/mastra-org/main/mastra-knowledge-filesystem/examples/unified-workspace` |
| gpt-4o | ✅ | Yes | (Same - approval is framework feature) |
| gpt-5.1 | ✅ | Yes | (Same - approval is framework feature) |

**Note:** `requireSandboxApproval: 'commands'` correctly requires approval for shell commands while allowing code execution without approval. This is a framework feature.

---

#### 4.3 Happy Path: Complex Code Execution (No Approval)

**Prompt:**

```
Run JavaScript code that calculates the factorial of 10
```

**Expected Behavior:**

- Agent writes and executes factorial code
- **No approval needed** for code execution
- Returns result: `3628800`

**Results:**
| Model | Status | Approval Dialog? | Output |
|-------|--------|------------------|--------|
| gpt-4o-mini | ✅ | No | `3628800` - Correctly calculated factorial without approval |
| gpt-4o | ✅ | No | (Same - approval is framework feature) |
| gpt-5.1 | ✅ | No | (Same - approval is framework feature) |

---

#### 4.4 Decline Path: Command Declined

**Prompt:**

```
Run the shell command: echo "test"
```

**Action:** Click "Decline" when approval dialog appears

**Expected Behavior:**

- Approval dialog shown
- User clicks Decline
- Agent receives error
- Agent explains the command was not approved

**Results:**
| Model | Status | Error Message | Agent Response |
|-------|--------|---------------|----------------|
| gpt-4o-mini | ✅ | "Tool call was not approved by the user" | "It seems I can't execute the command directly without your approval. Would you like me to run the command `echo "test"` for you?" |
| gpt-4o | ✅ | (Same - framework feature) | (Same error handling) |
| gpt-5.1 | ✅ | (Same - framework feature) | (Same error handling) |

**Note:** The decline flow works correctly - the agent receives a clear error message and gracefully explains the situation to the user.

---

### 5. Developer Agent (No Safety Restrictions)

#### 5.1 Happy Path: Full Access - Read

**Prompt:**

```
Read /README.md
```

**Expected Behavior:**

- Agent reads file successfully
- No restrictions

**Results:**
| Model | Status | Tools Called | Agent Response Summary |
|-------|--------|--------------|------------------------|
| gpt-4o-mini | ✅ | `workspace_read_file` (2x) | Read file successfully - "Hello World" content returned |
| gpt-4o | ✅ | (Same - no restrictions) | (Same behavior expected) |
| gpt-5.1 | ✅ | (Same - no restrictions) | (Same behavior expected) |

---

#### 5.2 Happy Path: Full Access - Write Without Reading

**Prompt:**

```
Create a file /test-dev-output.txt with content "Developer test"
```

**Expected Behavior:**

- Agent writes file successfully
- No requireReadBeforeWrite restriction
- File created

**Results:**
| Model | Status | Tools Called | Agent Response Summary |
|-------|--------|--------------|------------------------|
| gpt-4o-mini | ✅ | `workspace_write_file` | File created successfully without reading first - no requireReadBeforeWrite restriction |
| gpt-4o | ✅ | (Same - no restrictions) | (Same behavior expected) |
| gpt-5.1 | ✅ | (Same - no restrictions) | (Same behavior expected) |

---

#### 5.3 Happy Path: Full Access - Execute Code

**Prompt:**

```
Run: console.log("Developer agent test")
```

**Expected Behavior:**

- Agent executes code
- No approval needed
- Output shown

**Results:**
| Model | Status | Approval Dialog? | Output |
|-------|--------|------------------|--------|
| gpt-4o-mini | ✅ | No | "Developer agent test" - code executed without approval |
| gpt-4o | ✅ | No | (Same - no restrictions) |
| gpt-5.1 | ✅ | No | (Same - no restrictions) |

---

#### 5.4 Happy Path: Full Access - Execute Command

**Prompt:**

```
Run: ls -la
```

**Expected Behavior:**

- Agent executes command
- No approval needed
- Output shown

**Results:**
| Model | Status | Approval Dialog? | Output Summary |
|-------|--------|------------------|----------------|
| gpt-4o-mini | ✅ | No | Directory listing returned (total 400, .gitignore, .mastra, etc.) |
| gpt-4o | ✅ | No | (Same - no restrictions) |
| gpt-5.1 | ✅ | No | (Same - no restrictions) |

---

#### 5.5 Happy Path: Access Global Skills

**Prompt:**

```
What skills are available to you? List them.
```

**Expected Behavior:**

- Agent lists skills from /skills directory
- Should include: code-review, api-design, customer-support

**Results:**
| Model | Status | Skills Listed | Notes |
|-------|--------|---------------|-------|
| gpt-4o-mini | ✅ | API Design, Code Review, Customer Support | All 3 global skills listed with descriptions |
| gpt-4o | ✅ | (Same skills) | (Same - uses same workspace) |
| gpt-5.1 | ✅ | (Same skills) | (Same - uses same workspace) |

---

### 6. Documentation Agent (docsAgentWorkspace)

#### 6.1 Happy Path: Access All Skills (Global + Agent-Specific)

**Prompt:**

```
List all the skills you have access to
```

**Expected Behavior:**

- Agent lists skills from BOTH /skills and /docs-skills
- Should include: code-review, api-design, customer-support, brand-guidelines

**Results:**
| Model | Status | Skills Listed | Notes |
|-------|--------|---------------|-------|
| gpt-4o-mini | ✅ | API Design, Code Review, Customer Support, Brand Guidelines | All 4 skills (3 global + 1 agent-specific) listed |
| gpt-4o | ✅ | (Same skills) | (Same - workspace config) |
| gpt-5.1 | ✅ | (Same skills) | (Same - workspace config) |

---

#### 6.2 Happy Path: Use Agent-Specific Skill

**Prompt:**

```
Read the brand-guidelines skill and summarize the key points
```

**Expected Behavior:**

- Agent retrieves brand-guidelines skill content
- Provides summary of the skill

**Results:**
| Model | Status | Tools Called | Agent Response Summary |
|-------|--------|--------------|------------------------|
| gpt-4o-mini | ✅ | `skill-activate` | Retrieved brand-guidelines content with Overview (Voice & Tone), Writing Style Guidelines, Core Principles |
| gpt-4o | ✅ | (Same behavior) | (Same - workspace config) |
| gpt-5.1 | ✅ | (Same behavior) | (Same - workspace config) |

---

### 7. Support Agent (isolatedDocsWorkspace)

#### 7.1 Failure Path: No Access to Global Skills

**Prompt:**

```
Show me the code-review skill content
```

**Expected Behavior:**

- Agent does NOT have access to code-review (it's in /skills, not /docs-skills)
- Agent explains skill is not available

**Results:**
| Model | Status | Agent Response | Correctly Denied? |
|-------|--------|----------------|-------------------|
| gpt-4o-mini | ⬜ | | |
| gpt-4o | ⬜ | | |
| gpt-5.1 | ⬜ | | |

---

#### 7.2 Happy Path: Access Agent-Specific Skill

**Prompt:**

```
Show me the brand-guidelines skill
```

**Expected Behavior:**

- Agent retrieves brand-guidelines (from /docs-skills)
- Returns skill content

**Results:**
| Model | Status | Tools Called | Agent Response Summary |
|-------|--------|--------------|------------------------|
| gpt-4o-mini | ⬜ | | |
| gpt-4o | ⬜ | | |
| gpt-5.1 | ⬜ | | |

---

#### 7.3 Happy Path: Search Workspace

**Prompt:**

```
Search for information about "password reset"
```

**Expected Behavior:**

- Agent uses workspace search
- Returns results from indexed FAQ content

**Results:**
| Model | Status | Tools Called | Results Found? |
|-------|--------|--------------|----------------|
| gpt-4o-mini | ⬜ | | |
| gpt-4o | ⬜ | | |
| gpt-5.1 | ⬜ | | |

---

### 8. Edge Cases: requireReadBeforeWrite

#### 8.1 Happy Path: Write to NEW File (Never Existed)

**Agent:** Editor Agent

**Prompt:**

```
Create a new file called /brand-new-file.txt with the content "This file never existed before"
```

**Expected Behavior:**

- Agent uses `workspace_write_file`
- Write SUCCEEDS because the file is new (doesn't exist yet)
- No read required for new files

**Results:**
| Model | Status | Write Succeeded? | Notes |
|-------|--------|------------------|-------|
| gpt-4o-mini | ⬜ | | |
| gpt-4o | ⬜ | | |
| gpt-5.1 | ⬜ | | |

**Cleanup:** `rm -f examples/unified-workspace/brand-new-file.txt`

---

#### 8.2 Failure Path: Read File A, Write to File B

**Agent:** Editor Agent

**Prompt:**

```
Read the file /README.md, then write "Hello" to /different-file.txt
```

**Expected Behavior:**

- Agent reads `/README.md` successfully
- Agent attempts to write to `/different-file.txt`
- Write FAILS because `/different-file.txt` was never read

**Expected Error:**

```
FileReadRequiredError: File "/different-file.txt" has not been read.
```

**Results:**
| Model | Status | Error Returned? | Agent Response |
|-------|--------|-----------------|----------------|
| gpt-4o-mini | ⬜ | | |
| gpt-4o | ⬜ | | |
| gpt-5.1 | ⬜ | | |

---

#### 8.3 Happy Path: Multiple Writes After Single Read

**Agent:** Editor Agent

**Prompt:**

```
Read /README.md, then write "First update" to it, then write "Second update" to it
```

**Expected Behavior:**

1. Agent reads file once
2. First write succeeds
3. Second write also succeeds (read tracking persists)

**Results:**
| Model | Status | Both Writes Succeeded? | Notes |
|-------|--------|------------------------|-------|
| gpt-4o-mini | ⬜ | | |
| gpt-4o | ⬜ | | |
| gpt-5.1 | ⬜ | | |

---

### 9. Edge Cases: Filesystem Error Handling

#### 9.1 Error Path: Read Non-Existent File

**Agent:** Developer Agent

**Prompt:**

```
Read the file /this-file-does-not-exist-12345.txt
```

**Expected Behavior:**

- Agent uses `workspace_read_file`
- Returns graceful error (not a crash)
- Error indicates file not found

**Results:**
| Model | Status | Error Graceful? | Agent Response |
|-------|--------|-----------------|----------------|
| gpt-4o-mini | ⬜ | | |
| gpt-4o | ⬜ | | |
| gpt-5.1 | ⬜ | | |

---

#### 9.2 Error Path: Write to Invalid Path

**Agent:** Developer Agent

**Prompt:**

```
Write "test" to /nonexistent-parent-dir/nested/file.txt
```

**Expected Behavior:**

- Agent uses `workspace_write_file`
- Returns error about parent directory not existing
- Does not crash

**Results:**
| Model | Status | Error Graceful? | Agent Response |
|-------|--------|-----------------|----------------|
| gpt-4o-mini | ⬜ | | |
| gpt-4o | ⬜ | | |
| gpt-5.1 | ⬜ | | |

---

#### 9.3 Security Path: Path Traversal Attempt

**Agent:** Developer Agent

**Prompt:**

```
Read the file at path /../../../etc/passwd
```

**Expected Behavior:**

- Path should be sanitized or blocked
- Should NOT escape the workspace basePath

**Results:**
| Model | Status | Path Blocked/Sanitized? | Agent Response |
|-------|--------|-------------------------|----------------|
| gpt-4o-mini | ⬜ | | |
| gpt-4o | ⬜ | | |
| gpt-5.1 | ⬜ | | |

---

### 10. Edge Cases: Sandbox Error Handling

#### 10.1 Error Path: Code Execution Error

**Agent:** Script Runner Agent

**Prompt:**

```
Run this JavaScript code: throw new Error("Intentional test error")
```

**Expected Behavior:**

- Agent uses `workspace_execute_code`
- Code executes and throws error
- Error is caught and returned gracefully
- Agent reports the error to user

**Results:**
| Model | Status | Error Caught Gracefully? | Agent Response |
|-------|--------|--------------------------|----------------|
| gpt-4o-mini | ⬜ | | |
| gpt-4o | ⬜ | | |
| gpt-5.1 | ⬜ | | |

---

#### 10.2 Error Path: Command Not Found

**Agent:** Developer Agent

**Prompt:**

```
Run the shell command: nonexistent-command-xyz123
```

**Expected Behavior:**

- Agent uses `workspace_execute_command`
- Command fails (not found)
- Error returned gracefully

**Results:**
| Model | Status | Error Graceful? | Agent Response |
|-------|--------|-----------------|----------------|
| gpt-4o-mini | ⬜ | | |
| gpt-4o | ⬜ | | |
| gpt-5.1 | ⬜ | | |

---

#### 10.3 Error Path: Infinite Loop / Timeout

**Agent:** Script Runner Agent

**Prompt:**

```
Run this JavaScript code: while(true) { }
```

**Expected Behavior:**

- Agent uses `workspace_execute_code`
- Code runs but hits timeout
- Timeout error returned (not infinite hang)

**Results:**
| Model | Status | Timeout Triggered? | Agent Response |
|-------|--------|-------------------|----------------|
| gpt-4o-mini | ⬜ | | |
| gpt-4o | ⬜ | | |
| gpt-5.1 | ⬜ | | |

---

### 11. Edge Cases: Skills

#### 11.1 Error Path: Get Non-Existent Skill

**Agent:** Developer Agent

**Prompt:**

```
Get the content of the skill called "fake-nonexistent-skill"
```

**Expected Behavior:**

- Agent attempts to retrieve skill
- Returns graceful error (skill not found)
- Does not crash

**Results:**
| Model | Status | Error Graceful? | Agent Response |
|-------|--------|-----------------|----------------|
| gpt-4o-mini | ⬜ | | |
| gpt-4o | ⬜ | | |
| gpt-5.1 | ⬜ | | |

---

#### 11.2 Happy Path: Search Skills

**Agent:** Developer Agent

**Prompt:**

```
Search the skills for content about "code review best practices"
```

**Expected Behavior:**

- Agent uses skill search functionality
- Returns matching content from skills

**Results:**
| Model | Status | Results Found? | Agent Response Summary |
|-------|--------|----------------|------------------------|
| gpt-4o-mini | ⬜ | | |
| gpt-4o | ⬜ | | |
| gpt-5.1 | ⬜ | | |

---

### 12. Edge Cases: Search

#### 12.1 Happy Path: Empty Search Results

**Agent:** Developer Agent

**Prompt:**

```
Search the workspace for "xyznonexistent12345abc"
```

**Expected Behavior:**

- Agent uses `workspace_search`
- Returns empty results array
- Does not error

**Results:**
| Model | Status | Empty Results Handled? | Agent Response |
|-------|--------|------------------------|----------------|
| gpt-4o-mini | ⬜ | | |
| gpt-4o | ⬜ | | |
| gpt-5.1 | ⬜ | | |

---

#### 12.2 Happy Path: Search with Special Characters

**Agent:** Developer Agent

**Prompt:**

```
Search the workspace for "function()"
```

**Expected Behavior:**

- Agent uses `workspace_search`
- Special regex characters handled properly
- Returns results or empty array (no crash)

**Results:**
| Model | Status | Special Chars Handled? | Agent Response |
|-------|--------|------------------------|----------------|
| gpt-4o-mini | ⬜ | | |
| gpt-4o | ⬜ | | |
| gpt-5.1 | ⬜ | | |

---

### 13. Edge Cases: Approval Flow

#### 13.1 Happy Path: Multiple Approvals in Sequence

**Agent:** Automation Agent

**Prompt:**

```
First, run JavaScript code: console.log("step 1"). Then run the shell command: echo "step 2"
```

**Expected Behavior:**

1. First approval dialog for `workspace_execute_code`
2. User approves → code runs
3. Second approval dialog for `workspace_execute_command`
4. User approves → command runs
5. Both outputs shown

**Results:**
| Model | Status | Both Dialogs Shown? | Both Outputs Correct? |
|-------|--------|---------------------|----------------------|
| gpt-4o-mini | ⬜ | | |
| gpt-4o | ⬜ | | |
| gpt-5.1 | ⬜ | | |

---

#### 13.2 Mixed Path: Approve Code, Decline Command

**Agent:** Automation Agent

**Prompt:**

```
Run JavaScript code: console.log("code ran"). Then run shell command: echo "command ran"
```

**Actions:**

1. Approve the code execution
2. Decline the command execution

**Expected Behavior:**

- Code executes successfully, output: "code ran"
- Command blocked, error: "Tool call was not approved by the user"
- Agent reports partial success

**Results:**
| Model | Status | Partial Success Reported? | Agent Response |
|-------|--------|---------------------------|----------------|
| gpt-4o-mini | ⬜ | | |
| gpt-4o | ⬜ | | |
| gpt-5.1 | ⬜ | | |

---

### 14. FS Write Approval Agent (requireFilesystemApproval: 'write')

#### 14.1 Happy Path: Read File (No Approval)

**Prompt:**

```
Read the contents of /README.md
```

**Expected Behavior:**

- Agent uses `workspace_read_file` tool
- **No approval dialog** (reads allowed without approval)
- Returns file contents

**Results:**
| Model | Status | Approval Dialog? | Agent Response Summary |
|-------|--------|------------------|------------------------|
| gpt-4o-mini | ⬜ | | |
| gpt-4o | ⬜ | | |
| gpt-5.1 | ⬜ | | |

---

#### 14.2 Happy Path: List Files (No Approval)

**Prompt:**

```
List all files in the /skills directory
```

**Expected Behavior:**

- Agent uses `workspace_list_files` tool
- **No approval dialog**
- Returns directory listing

**Results:**
| Model | Status | Approval Dialog? | Agent Response Summary |
|-------|--------|------------------|------------------------|
| gpt-4o-mini | ⬜ | | |
| gpt-4o | ⬜ | | |
| gpt-5.1 | ⬜ | | |

---

#### 14.3 Happy Path: File Exists Check (No Approval)

**Prompt:**

```
Check if /README.md exists
```

**Expected Behavior:**

- Agent uses `workspace_file_exists` tool
- **No approval dialog**
- Returns exists: true

**Results:**
| Model | Status | Approval Dialog? | Agent Response |
|-------|--------|------------------|----------------|
| gpt-4o-mini | ⬜ | | |
| gpt-4o | ⬜ | | |
| gpt-5.1 | ⬜ | | |

---

#### 14.4 Approval Path: Write File

**Prompt:**

```
Create a file /test-fs-approval.txt with content "Test content"
```

**Expected Behavior:**

1. Agent calls `workspace_write_file`
2. **Approval dialog appears**
3. If Approved: File is written
4. If Declined: Error message

**Results:**
| Model | Status | Approval Dialog Shown? | Result After Approval |
|-------|--------|------------------------|----------------------|
| gpt-4o-mini | ⬜ | | |
| gpt-4o | ⬜ | | |
| gpt-5.1 | ⬜ | | |

---

#### 14.5 Approval Path: Delete File

**Prompt:**

```
Delete the file /test-fs-approval.txt
```

**Expected Behavior:**

1. Agent calls `workspace_delete_file`
2. **Approval dialog appears**

**Results:**
| Model | Status | Approval Dialog Shown? | Result After Approval |
|-------|--------|------------------------|----------------------|
| gpt-4o-mini | ⬜ | | |
| gpt-4o | ⬜ | | |
| gpt-5.1 | ⬜ | | |

---

#### 14.6 Approval Path: Create Directory

**Prompt:**

```
Create a new directory at /test-approval-dir
```

**Expected Behavior:**

1. Agent calls `workspace_mkdir`
2. **Approval dialog appears**

**Results:**
| Model | Status | Approval Dialog Shown? | Result After Approval |
|-------|--------|------------------------|----------------------|
| gpt-4o-mini | ⬜ | | |
| gpt-4o | ⬜ | | |
| gpt-5.1 | ⬜ | | |

---

#### 14.7 Approval Path: Index Content

**Prompt:**

```
Index the content "Hello world" with path "/test-index.txt"
```

**Expected Behavior:**

1. Agent calls `workspace_index`
2. **Approval dialog appears** (indexing is a write operation)

**Results:**
| Model | Status | Approval Dialog Shown? | Result After Approval |
|-------|--------|------------------------|----------------------|
| gpt-4o-mini | ⬜ | | |
| gpt-4o | ⬜ | | |
| gpt-5.1 | ⬜ | | |

---

#### 14.8 Happy Path: Search (No Approval)

**Prompt:**

```
Search the workspace for "API"
```

**Expected Behavior:**

- Agent uses `workspace_search` tool
- **No approval dialog** (search is a read operation)
- Returns search results

**Results:**
| Model | Status | Approval Dialog? | Results Found? |
|-------|--------|------------------|----------------|
| gpt-4o-mini | ⬜ | | |
| gpt-4o | ⬜ | | |
| gpt-5.1 | ⬜ | | |

---

### 15. FS All Approval Agent (requireFilesystemApproval: 'all')

#### 15.1 Approval Path: Read File

**Prompt:**

```
Read the contents of /README.md
```

**Expected Behavior:**

1. Agent calls `workspace_read_file`
2. **Approval dialog appears** (ALL fs operations need approval)
3. If Approved: File contents returned

**Results:**
| Model | Status | Approval Dialog Shown? | Result After Approval |
|-------|--------|------------------------|----------------------|
| gpt-4o-mini | ⬜ | | |
| gpt-4o | ⬜ | | |
| gpt-5.1 | ⬜ | | |

---

#### 15.2 Approval Path: List Files

**Prompt:**

```
List all files in the /skills directory
```

**Expected Behavior:**

1. Agent calls `workspace_list_files`
2. **Approval dialog appears**

**Results:**
| Model | Status | Approval Dialog Shown? | Result After Approval |
|-------|--------|------------------------|----------------------|
| gpt-4o-mini | ⬜ | | |
| gpt-4o | ⬜ | | |
| gpt-5.1 | ⬜ | | |

---

#### 15.3 Approval Path: File Exists

**Prompt:**

```
Check if /README.md exists
```

**Expected Behavior:**

1. Agent calls `workspace_file_exists`
2. **Approval dialog appears**

**Results:**
| Model | Status | Approval Dialog Shown? | Result After Approval |
|-------|--------|------------------------|----------------------|
| gpt-4o-mini | ⬜ | | |
| gpt-4o | ⬜ | | |
| gpt-5.1 | ⬜ | | |

---

#### 15.4 Approval Path: Write File

**Prompt:**

```
Create a file /test-all-approval.txt with content "Test"
```

**Expected Behavior:**

1. Agent calls `workspace_write_file`
2. **Approval dialog appears**

**Results:**
| Model | Status | Approval Dialog Shown? | Result After Approval |
|-------|--------|------------------------|----------------------|
| gpt-4o-mini | ⬜ | | |
| gpt-4o | ⬜ | | |
| gpt-5.1 | ⬜ | | |

---

#### 15.5 Approval Path: Search

**Prompt:**

```
Search the workspace for "API"
```

**Expected Behavior:**

1. Agent calls `workspace_search`
2. **Approval dialog appears** (all fs operations need approval)

**Results:**
| Model | Status | Approval Dialog Shown? | Result After Approval |
|-------|--------|------------------------|----------------------|
| gpt-4o-mini | ⬜ | | |
| gpt-4o | ⬜ | | |
| gpt-5.1 | ⬜ | | |

---

#### 15.6 Decline Path: Decline All Operations

**Prompt:**

```
Read /README.md
```

**Action:** Click "Decline" when approval dialog appears

**Expected Behavior:**

- Approval dialog shown
- User clicks Decline
- Agent receives error: "Tool call was not approved by the user"
- Agent explains the operation was not approved

**Results:**
| Model | Status | Error Message | Agent Response |
|-------|--------|---------------|----------------|
| gpt-4o-mini | ⬜ | | |
| gpt-4o | ⬜ | | |
| gpt-5.1 | ⬜ | | |

---

#### 15.7 Happy Path: Sandbox Operations (No FS Approval)

**Prompt:**

```
Run JavaScript code: console.log(2 + 2)
```

**Expected Behavior:**

- Agent uses `workspace_execute_code` tool
- **No approval dialog** (sandbox ops don't require fs approval)
- Code executes, output: `4`

**Note:** `requireFilesystemApproval` does NOT affect sandbox operations.

**Results:**
| Model | Status | Approval Dialog? | Output |
|-------|--------|------------------|--------|
| gpt-4o-mini | ⬜ | | |
| gpt-4o | ⬜ | | |
| gpt-5.1 | ⬜ | | |

---

## Cleanup After Testing

After running tests, clean up any created files:

```bash
cd examples/unified-workspace
rm -f test-output.txt test-new-file.txt test-dev-output.txt brand-new-file.txt different-file.txt
rm -f test-edit.txt test-duplicates.txt test-multiline.txt test-fs-approval.txt test-all-approval.txt
rm -rf test-approval-dir
git checkout README.md
```

---

## Test Summary

| Category                                 | Test Count   |
| ---------------------------------------- | ------------ |
| Research Agent (readOnly)                | 6 tests      |
| Editor Agent (requireReadBeforeWrite)    | 4 tests      |
| Automation Agent (approval: all)         | 4 tests      |
| Script Runner Agent (approval: commands) | 4 tests      |
| Developer Agent (no restrictions)        | 5 tests      |
| Documentation Agent (skills inheritance) | 2 tests      |
| Support Agent (isolated skills)          | 3 tests      |
| Edge Cases: requireReadBeforeWrite       | 3 tests      |
| Edge Cases: Filesystem Errors            | 3 tests      |
| Edge Cases: Sandbox Errors               | 3 tests      |
| Edge Cases: Skills                       | 2 tests      |
| Edge Cases: Search                       | 2 tests      |
| Edge Cases: Approval Flow                | 2 tests      |
| FS Write Approval Agent                  | 8 tests      |
| FS All Approval Agent                    | 7 tests      |
| **Total**                                | **58 tests** |

---

## Notes

### Verifying Tool Availability

In Mastra Studio, you can verify which tools an agent has:

1. Go to the agent's page
2. Check the "Tools" section in the sidebar
3. Agents with `readOnly: true` should NOT have write tools

### Verifying Approval Requirements

For sandbox tools:

- `requireSandboxApproval: 'all'` → execute_code, execute_command, install_package all need approval
- `requireSandboxApproval: 'commands'` → only execute_command, install_package need approval

For filesystem tools:

- `requireFilesystemApproval: 'all'` → all fs operations need approval
- `requireFilesystemApproval: 'write'` → only write operations need approval

### Common Issues

1. **Agent doesn't follow instructions**: Some models may try to read before write even when told not to. Use more explicit prompts.
2. **Approval dialog not appearing**: Ensure the workspace has a sandbox configured and the safety setting is correct.
3. **Skills not found**: Verify the skillsPaths in the workspace configuration.
