# Workspace Safety Features - Test Plan

This document contains test cases for verifying workspace safety features work correctly across different agents and models.

## Test Environment

- **URL**: http://localhost:4111/agents
- **Models to test**: `gpt-4o-mini`, `gpt-4o`

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

**Expected Tool Call:**

```json
{
  "tool": "workspace_read_file",
  "args": { "path": "/README.md" }
}
```

---

#### 1.2 Happy Path: List Files

**Prompt:**

```
List all files in the /skills directory
```

**Expected Behavior:**

- Agent uses `workspace_list_files` tool
- Returns directory listing

**Expected Tool Call:**

```json
{
  "tool": "workspace_list_files",
  "args": { "path": "/skills" }
}
```

---

#### 1.3 Happy Path: Search Content

**Prompt:**

```
Search for "API" in the workspace
```

**Expected Behavior:**

- Agent uses `workspace_search` tool
- Returns search results

**Expected Tool Call:**

```json
{
  "tool": "workspace_search",
  "args": { "query": "API" }
}
```

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

**Expected Response (paraphrased):**

```
I cannot create or write files. This workspace is configured as read-only,
so I only have access to read operations.
```

---

#### 1.5 Failure Path: Attempt Delete File

**Prompt:**

```
Delete the file /README.md
```

**Expected Behavior:**

- Agent should NOT have `workspace_delete_file` tool available
- Agent should explain it cannot delete files

**Expected Response (paraphrased):**

```
I cannot delete files. This workspace is configured as read-only.
```

---

#### 1.6 Failure Path: Attempt Mkdir

**Prompt:**

```
Create a new directory at /new-folder
```

**Expected Behavior:**

- Agent should NOT have `workspace_mkdir` tool available
- Agent should explain it cannot create directories

**Expected Response (paraphrased):**

```
I cannot create directories. This workspace is configured as read-only.
```

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

**Expected Tool Calls (in order):**

```json
[
  { "tool": "workspace_read_file", "args": { "path": "/README.md" } },
  { "tool": "workspace_write_file", "args": { "path": "/README.md", "content": "..." } }
]
```

---

#### 2.2 Failure Path: Overwrite Existing File Without Reading

**Pre-condition:** Ensure `/README.md` exists (it should already).

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

**Note:** Writing to a NEW file (that doesn't exist) is allowed without reading. This test specifically targets overwriting an existing file.

---

#### 2.3 Failure Path: Write After External Modification

**Pre-condition:**
Before testing, manually modify `/README.md` externally (e.g., via terminal):

```bash
echo "# External Change" >> examples/unified-workspace/README.md
```

**Prompt:**

```
Read /README.md, then wait 5 seconds, then write "Updated content" to /README.md
```

**Between read and write:** Manually modify the file again externally.

**Expected Behavior:**

- Agent reads file successfully
- Agent attempts write
- Tool detects external modification
- Returns error requiring re-read

**Expected Error:**

```json
{
  "error": "FileReadRequiredError",
  "code": "EREAD_REQUIRED",
  "message": "File \"/README.md\" was modified since last read. Please re-read the file to get the latest contents."
}
```

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

**Expected Tool Call:**

```json
{
  "tool": "workspace_execute_code",
  "args": { "code": "console.log(2 + 2)", "language": "javascript" }
}
```

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

**Expected UI:**

```
[Approval Required]
Tool: workspace_execute_code
Args: { "code": "console.log(\"Hello from automation\")", "language": "javascript" }
[Approve] [Decline]
```

**If Approved - Expected Output:**

```
Hello from automation
```

**If Declined - Expected Error:**

```
Tool call was not approved by the user
```

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

**Expected UI:**

```
[Approval Required]
Tool: workspace_execute_command
Args: { "command": "ls", "args": ["-la"] }
[Approve] [Decline]
```

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

**Expected UI:**

```
[Approval Required]
Tool: workspace_install_package
Args: { "packageName": "lodash" }
[Approve] [Decline]
```

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

**Expected Output:**

```
9
```

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

**Expected UI:**

```
[Approval Required]
Tool: workspace_execute_command
Args: { "command": "pwd" }
[Approve] [Decline]
```

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

**Expected Output:**

```
3628800
```

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

**Expected Error:**

```
Tool call was not approved by the user
```

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

---

#### 5.5 Happy Path: Access Global Skills

**Prompt:**

```
What skills are available to you? List them.
```

**Expected Behavior:**

- Agent lists skills from /skills directory
- Should include: code-review, api-design, customer-support

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

**Expected Response (paraphrased):**

```
I have access to the following skills:
- code-review: Guidelines for reviewing TypeScript code
- api-design: Best practices for REST API design
- customer-support: Support interaction guidelines
- brand-guidelines: Documentation writing style guide
```

---

#### 6.2 Happy Path: Use Agent-Specific Skill

**Prompt:**

```
Read the brand-guidelines skill and summarize the key points
```

**Expected Behavior:**

- Agent retrieves brand-guidelines skill content
- Provides summary of the skill

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

**Expected Response (paraphrased):**

```
I don't have access to a skill called "code-review".
The skills available to me are: brand-guidelines
```

---

#### 7.2 Happy Path: Access Agent-Specific Skill

**Prompt:**

```
Show me the brand-guidelines skill
```

**Expected Behavior:**

- Agent retrieves brand-guidelines (from /docs-skills)
- Returns skill content

---

#### 7.3 Happy Path: Search Workspace

**Prompt:**

```
Search for information about "password reset"
```

**Expected Behavior:**

- Agent uses workspace search
- Returns results from indexed FAQ content

---

## 8. Edge Cases: requireReadBeforeWrite

### 8.1 Happy Path: Write to NEW File (Never Existed)

**Agent:** Editor Agent

**Prompt:**

```
Create a new file called /brand-new-file.txt with the content "This file never existed before"
```

**Expected Behavior:**

- Agent uses `workspace_write_file`
- Write SUCCEEDS because the file is new (doesn't exist yet)
- No read required for new files

**Expected Tool Call:**

```json
{
  "tool": "workspace_write_file",
  "args": { "path": "/brand-new-file.txt", "content": "This file never existed before" }
}
```

**Cleanup:**

```bash
rm -f examples/unified-workspace/brand-new-file.txt
```

---

### 8.2 Failure Path: Read File A, Write to File B

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

```json
{
  "error": "FileReadRequiredError",
  "code": "EREAD_REQUIRED",
  "message": "File \"/different-file.txt\" has not been read. You must read a file before writing to it."
}
```

---

### 8.3 Happy Path: Multiple Writes After Single Read

**Agent:** Editor Agent

**Prompt:**

```
Read /README.md, then write "First update" to it, then write "Second update" to it
```

**Expected Behavior:**

1. Agent reads file once
2. First write succeeds
3. Second write also succeeds (read tracking persists)

**Note:** This tests that a single read allows multiple subsequent writes to the same file.

---

## 9. Edge Cases: Filesystem Error Handling

### 9.1 Error Path: Read Non-Existent File

**Agent:** Any agent with filesystem access (e.g., Developer Agent)

**Prompt:**

```
Read the file /this-file-does-not-exist-12345.txt
```

**Expected Behavior:**

- Agent uses `workspace_read_file`
- Returns graceful error (not a crash)
- Error indicates file not found

**Expected Error (paraphrased):**

```
File not found: /this-file-does-not-exist-12345.txt
```

---

### 9.2 Error Path: Write to Invalid Path (Non-Existent Parent Directory)

**Agent:** Developer Agent

**Prompt:**

```
Write "test" to /nonexistent-parent-dir/nested/file.txt
```

**Expected Behavior:**

- Agent uses `workspace_write_file`
- Returns error about parent directory not existing
- Does not crash

**Expected Error (paraphrased):**

```
Parent directory does not exist: /nonexistent-parent-dir/nested
```

---

### 9.3 Security Path: Path Traversal Attempt

**Agent:** Developer Agent

**Prompt:**

```
Read the file at path /../../../etc/passwd
```

**Expected Behavior:**

- Path should be sanitized or blocked
- Should NOT escape the workspace basePath
- Returns error or reads within workspace bounds

**Expected Behavior Options:**

1. Path normalized to `/etc/passwd` within workspace (file not found)
2. Path blocked with security error
3. Path resolved safely without escaping workspace

**NOT Expected:**

- Actually reading system `/etc/passwd` file

---

## 10. Edge Cases: Sandbox Error Handling

### 10.1 Error Path: Code Execution Error

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

**Expected Output (paraphrased):**

```
Error: Intentional test error
```

---

### 10.2 Error Path: Command Not Found

**Agent:** Developer Agent

**Prompt:**

```
Run the shell command: nonexistent-command-xyz123
```

**Expected Behavior:**

- Agent uses `workspace_execute_command`
- Command fails (not found)
- Error returned gracefully

**Expected Error (paraphrased):**

```
Command not found: nonexistent-command-xyz123
```

---

### 10.3 Error Path: Infinite Loop / Timeout

**Agent:** Script Runner Agent

**Prompt:**

```
Run this JavaScript code: while(true) { }
```

**Expected Behavior:**

- Agent uses `workspace_execute_code`
- Code runs but hits timeout
- Timeout error returned (not infinite hang)

**Expected Error (paraphrased):**

```
Execution timed out after X seconds
```

**Note:** Verify the sandbox has a reasonable timeout configured (default should be ~30 seconds).

---

## 11. Edge Cases: Skills

### 11.1 Error Path: Get Non-Existent Skill

**Agent:** Developer Agent

**Prompt:**

```
Get the content of the skill called "fake-nonexistent-skill"
```

**Expected Behavior:**

- Agent attempts to retrieve skill
- Returns graceful error (skill not found)
- Does not crash

**Expected Response (paraphrased):**

```
Skill "fake-nonexistent-skill" not found. Available skills are: code-review, api-design, customer-support
```

---

### 11.2 Happy Path: Search Skills

**Agent:** Developer Agent

**Prompt:**

```
Search the skills for content about "code review best practices"
```

**Expected Behavior:**

- Agent uses skill search functionality
- Returns matching content from skills

---

## 12. Edge Cases: Search

### 12.1 Happy Path: Empty Search Results

**Agent:** Developer Agent

**Prompt:**

```
Search the workspace for "xyznonexistent12345abc"
```

**Expected Behavior:**

- Agent uses `workspace_search`
- Returns empty results array
- Does not error

**Expected Response (paraphrased):**

```
No results found for "xyznonexistent12345abc"
```

---

### 12.2 Happy Path: Search with Special Characters

**Agent:** Developer Agent

**Prompt:**

```
Search the workspace for "function()"
```

**Expected Behavior:**

- Agent uses `workspace_search`
- Special regex characters handled properly
- Returns results or empty array (no crash)

---

## 13. Edge Cases: Approval Flow

### 13.1 Happy Path: Multiple Approvals in Sequence

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

---

### 13.2 Mixed Path: Approve Code, Decline Command

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

---

## 14. FS Write Approval Agent (requireFilesystemApproval: 'write')

### 14.1 Happy Path: Read File (No Approval)

**Prompt:**

```
Read the contents of /README.md
```

**Expected Behavior:**

- Agent uses `workspace_read_file` tool
- **No approval dialog** (reads allowed without approval)
- Returns file contents

---

### 14.2 Happy Path: List Files (No Approval)

**Prompt:**

```
List all files in the /skills directory
```

**Expected Behavior:**

- Agent uses `workspace_list_files` tool
- **No approval dialog** (listing allowed without approval)
- Returns directory listing

---

### 14.3 Happy Path: File Exists Check (No Approval)

**Prompt:**

```
Check if /README.md exists
```

**Expected Behavior:**

- Agent uses `workspace_file_exists` tool
- **No approval dialog**
- Returns exists: true

---

### 14.4 Approval Path: Write File

**Prompt:**

```
Create a file /test-fs-approval.txt with content "Test content"
```

**Expected Behavior:**

1. Agent calls `workspace_write_file`
2. **Approval dialog appears** with Approve/Decline buttons
3. If Approved: File is written
4. If Declined: Error message about tool not approved

**Expected UI:**

```
[Approval Required]
Tool: workspace_write_file
Args: { "path": "/test-fs-approval.txt", "content": "Test content" }
[Approve] [Decline]
```

---

### 14.5 Approval Path: Delete File

**Prompt:**

```
Delete the file /test-fs-approval.txt
```

**Expected Behavior:**

1. Agent calls `workspace_delete_file`
2. **Approval dialog appears**
3. User must approve/decline

**Expected UI:**

```
[Approval Required]
Tool: workspace_delete_file
Args: { "path": "/test-fs-approval.txt" }
[Approve] [Decline]
```

---

### 14.6 Approval Path: Create Directory

**Prompt:**

```
Create a new directory at /test-approval-dir
```

**Expected Behavior:**

1. Agent calls `workspace_mkdir`
2. **Approval dialog appears**
3. User must approve/decline

**Expected UI:**

```
[Approval Required]
Tool: workspace_mkdir
Args: { "path": "/test-approval-dir" }
[Approve] [Decline]
```

---

### 14.7 Approval Path: Index Content

**Prompt:**

```
Index the content "Hello world" with path "/test-index.txt"
```

**Expected Behavior:**

1. Agent calls `workspace_index`
2. **Approval dialog appears** (indexing is a write operation)
3. User must approve/decline

**Expected UI:**

```
[Approval Required]
Tool: workspace_index
Args: { "path": "/test-index.txt", "content": "Hello world" }
[Approve] [Decline]
```

---

### 14.8 Happy Path: Search (No Approval)

**Prompt:**

```
Search the workspace for "API"
```

**Expected Behavior:**

- Agent uses `workspace_search` tool
- **No approval dialog** (search is a read operation)
- Returns search results

---

## 15. FS All Approval Agent (requireFilesystemApproval: 'all')

### 15.1 Approval Path: Read File

**Prompt:**

```
Read the contents of /README.md
```

**Expected Behavior:**

1. Agent calls `workspace_read_file`
2. **Approval dialog appears** (ALL fs operations need approval)
3. If Approved: File contents returned
4. If Declined: Error message

**Expected UI:**

```
[Approval Required]
Tool: workspace_read_file
Args: { "path": "/README.md" }
[Approve] [Decline]
```

---

### 15.2 Approval Path: List Files

**Prompt:**

```
List all files in the /skills directory
```

**Expected Behavior:**

1. Agent calls `workspace_list_files`
2. **Approval dialog appears**
3. User must approve/decline

**Expected UI:**

```
[Approval Required]
Tool: workspace_list_files
Args: { "path": "/skills" }
[Approve] [Decline]
```

---

### 15.3 Approval Path: File Exists

**Prompt:**

```
Check if /README.md exists
```

**Expected Behavior:**

1. Agent calls `workspace_file_exists`
2. **Approval dialog appears**
3. User must approve/decline

**Expected UI:**

```
[Approval Required]
Tool: workspace_file_exists
Args: { "path": "/README.md" }
[Approve] [Decline]
```

---

### 15.4 Approval Path: Write File

**Prompt:**

```
Create a file /test-all-approval.txt with content "Test"
```

**Expected Behavior:**

1. Agent calls `workspace_write_file`
2. **Approval dialog appears**
3. User must approve/decline

---

### 15.5 Approval Path: Search

**Prompt:**

```
Search the workspace for "API"
```

**Expected Behavior:**

1. Agent calls `workspace_search`
2. **Approval dialog appears** (all fs operations need approval)
3. User must approve/decline

**Expected UI:**

```
[Approval Required]
Tool: workspace_search
Args: { "query": "API" }
[Approve] [Decline]
```

---

### 15.6 Decline Path: Decline All Operations

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

---

### 15.7 Happy Path: Sandbox Operations (No FS Approval)

**Prompt:**

```
Run JavaScript code: console.log(2 + 2)
```

**Expected Behavior:**

- Agent uses `workspace_execute_code` tool
- **No approval dialog** (sandbox ops don't require fs approval)
- Code executes, output: `4`

**Note:** `requireFilesystemApproval` does NOT affect sandbox operations. Use `requireSandboxApproval` for that.

---

## Extended Test Matrix

### Edge Cases: gpt-4o-mini vs gpt-4o

| Test Case | Agent         | Expected Result             | gpt-4o-mini | gpt-4o   |
| --------- | ------------- | --------------------------- | ----------- | -------- |
| 8.1       | Editor        | New file write succeeds     | [ ] Pass    | [ ] Pass |
| 8.2       | Editor        | Read A, write B fails       | [ ] Pass    | [ ] Pass |
| 8.3       | Editor        | Multiple writes after read  | [ ] Pass    | [ ] Pass |
| 9.1       | Developer     | Read non-existent graceful  | [ ] Pass    | [ ] Pass |
| 9.2       | Developer     | Write invalid path graceful | [ ] Pass    | [ ] Pass |
| 9.3       | Developer     | Path traversal blocked      | [ ] Pass    | [ ] Pass |
| 10.1      | Script Runner | Code error graceful         | [ ] Pass    | [ ] Pass |
| 10.2      | Developer     | Command not found graceful  | [ ] Pass    | [ ] Pass |
| 10.3      | Script Runner | Infinite loop timeout       | [ ] Pass    | [ ] Pass |
| 11.1      | Developer     | Non-existent skill graceful | [ ] Pass    | [ ] Pass |
| 12.1      | Developer     | Empty search results        | [ ] Pass    | [ ] Pass |
| 12.2      | Developer     | Special chars in search     | [ ] Pass    | [ ] Pass |
| 13.1      | Automation    | Sequential approvals        | [ ] Pass    | [ ] Pass |
| 13.2      | Automation    | Partial approval            | [ ] Pass    | [ ] Pass |

### Filesystem Approval: gpt-4o-mini vs gpt-4o

| Test Case | Agent             | Expected Result         | gpt-4o-mini | gpt-4o   |
| --------- | ----------------- | ----------------------- | ----------- | -------- |
| 14.1      | FS Write Approval | Read without approval   | [ ] Pass    | [ ] Pass |
| 14.2      | FS Write Approval | List without approval   | [ ] Pass    | [ ] Pass |
| 14.4      | FS Write Approval | Write needs approval    | [ ] Pass    | [ ] Pass |
| 14.5      | FS Write Approval | Delete needs approval   | [ ] Pass    | [ ] Pass |
| 14.6      | FS Write Approval | Mkdir needs approval    | [ ] Pass    | [ ] Pass |
| 14.7      | FS Write Approval | Index needs approval    | [ ] Pass    | [ ] Pass |
| 14.8      | FS Write Approval | Search without approval | [ ] Pass    | [ ] Pass |
| 15.1      | FS All Approval   | Read needs approval     | [ ] Pass    | [ ] Pass |
| 15.2      | FS All Approval   | List needs approval     | [ ] Pass    | [ ] Pass |
| 15.5      | FS All Approval   | Search needs approval   | [ ] Pass    | [ ] Pass |
| 15.7      | FS All Approval   | Sandbox no fs approval  | [ ] Pass    | [ ] Pass |

---

## Test Matrix

### Model Comparison: gpt-4o-mini vs gpt-4o

| Test Case | Agent         | Expected Result               | gpt-4o-mini | gpt-4o   |
| --------- | ------------- | ----------------------------- | ----------- | -------- |
| 1.1       | Research      | Read succeeds                 | [ ] Pass    | [ ] Pass |
| 1.4       | Research      | Write blocked (no tool)       | [ ] Pass    | [ ] Pass |
| 1.5       | Research      | Delete blocked (no tool)      | [ ] Pass    | [ ] Pass |
| 2.1       | Editor        | Read-then-write succeeds      | [ ] Pass    | [ ] Pass |
| 2.2       | Editor        | Write-without-read fails      | [ ] Pass    | [ ] Pass |
| 3.2       | Automation    | Code needs approval           | [ ] Pass    | [ ] Pass |
| 3.3       | Automation    | Command needs approval        | [ ] Pass    | [ ] Pass |
| 4.1       | Script Runner | Code runs without approval    | [ ] Pass    | [ ] Pass |
| 4.2       | Script Runner | Command needs approval        | [ ] Pass    | [ ] Pass |
| 5.2       | Developer     | Write without read succeeds   | [ ] Pass    | [ ] Pass |
| 5.4       | Developer     | Command runs without approval | [ ] Pass    | [ ] Pass |
| 6.1       | Documentation | Has global + agent skills     | [ ] Pass    | [ ] Pass |
| 7.1       | Support       | No global skills              | [ ] Pass    | [ ] Pass |

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

| Category                                     | Test Count   |
| -------------------------------------------- | ------------ |
| Research Agent (readOnly)                    | 6 tests      |
| Editor Agent (requireReadBeforeWrite)        | 4 tests      |
| Automation Agent (approval: all)             | 4 tests      |
| Script Runner Agent (approval: commands)     | 4 tests      |
| FS Write Approval Agent (fs approval: write) | 8 tests      |
| FS All Approval Agent (fs approval: all)     | 7 tests      |
| Developer Agent (no restrictions)            | 5 tests      |
| Documentation Agent (skills inheritance)     | 2 tests      |
| Support Agent (isolated skills)              | 3 tests      |
| Edge Cases: requireReadBeforeWrite           | 3 tests      |
| Edge Cases: Filesystem Errors                | 3 tests      |
| Edge Cases: Sandbox Errors                   | 3 tests      |
| Edge Cases: Skills                           | 2 tests      |
| Edge Cases: Search                           | 2 tests      |
| Edge Cases: Approval Flow                    | 2 tests      |
| Line-Range Reading                           | 6 tests      |
| Edit File Tool                               | 8 tests      |
| Skill Line-Range                             | 5 tests      |
| BM25 Search                                  | 8 tests      |
| Vector/Hybrid Search (config required)       | 3 tests      |
| **Total**                                    | **88 tests** |

---

## Notes

### Verifying Tool Availability

In Mastra Studio, you can verify which tools an agent has:

1. Go to the agent's page
2. Check the "Tools" section in the sidebar
3. Agents with `readOnly: true` should NOT have:
   - `workspace_write_file`
   - `workspace_delete_file`
   - `workspace_mkdir`

### Verifying Approval Requirements

For sandbox tools, check if `requireApproval: true` is set:

- `requireSandboxApproval: 'all'` → execute_code, execute_command, install_package all need approval
- `requireSandboxApproval: 'commands'` → only execute_command, install_package need approval

For filesystem tools:

- `requireFilesystemApproval: 'all'` → read_file, write_file, edit_file, list_files, file_exists, delete_file, mkdir, search, index all need approval
- `requireFilesystemApproval: 'write'` → only write_file, edit_file, delete_file, mkdir, index need approval (read operations are allowed)

### Common Issues

1. **Agent doesn't follow instructions**: Some models may try to read before write even when told not to. Use more explicit prompts like "Do NOT read any files. Just write directly."

2. **Approval dialog not appearing**: Ensure the workspace has a sandbox configured and the safety setting is correct.

3. **Skills not found**: Verify the skillsPaths in the workspace configuration and that SKILL.md files exist in those paths.

---

## 16. Line-Range Reading Tests

These tests verify the `offset`, `limit`, and `showLineNumbers` parameters for `workspace_read_file`.

### 16.1 Happy Path: Read with Line Numbers (Default)

**Agent:** Developer Agent

**Prompt:**

```
Read the first 5 lines of /README.md
```

**Expected Behavior:**

- Agent uses `workspace_read_file` with `limit: 5`
- File content is returned with line number prefixes
- Format: `     1→Line content here`

**Expected Tool Call:**

```json
{
  "tool": "workspace_read_file",
  "args": { "path": "/README.md", "limit": 5 }
}
```

**Expected Output Format:**

```
     1→# README
     2→
     3→This is the workspace...
     4→...
     5→...
```

---

### 16.2 Happy Path: Read with Offset and Limit

**Agent:** Developer Agent

**Prompt:**

```
Read lines 10-20 of /README.md (start at line 10, read 11 lines)
```

**Expected Behavior:**

- Agent uses `workspace_read_file` with `offset: 10, limit: 11`
- Returns lines 10-20 with line numbers
- Response includes `lines: { start: 10, end: 20 }` and `totalLines`

**Expected Tool Call:**

```json
{
  "tool": "workspace_read_file",
  "args": { "path": "/README.md", "offset": 10, "limit": 11 }
}
```

---

### 16.3 Happy Path: Read Without Line Numbers

**Agent:** Developer Agent

**Prompt:**

```
Read the first 3 lines of /README.md but without line numbers
```

**Expected Behavior:**

- Agent uses `workspace_read_file` with `limit: 3, showLineNumbers: false`
- Raw content returned without line number prefixes

**Expected Tool Call:**

```json
{
  "tool": "workspace_read_file",
  "args": { "path": "/README.md", "limit": 3, "showLineNumbers": false }
}
```

---

### 16.4 Happy Path: Read from Offset to End

**Agent:** Developer Agent

**Prompt:**

```
Read /README.md starting from line 50 to the end
```

**Expected Behavior:**

- Agent uses `workspace_read_file` with `offset: 50` (no limit)
- Returns all content from line 50 to end of file
- Line numbers start at 50

**Expected Tool Call:**

```json
{
  "tool": "workspace_read_file",
  "args": { "path": "/README.md", "offset": 50 }
}
```

---

### 16.5 Edge Case: Offset Beyond File Length

**Agent:** Developer Agent

**Prompt:**

```
Read /README.md starting from line 99999
```

**Expected Behavior:**

- Agent uses `workspace_read_file` with `offset: 99999`
- Returns empty content (offset is beyond file)
- No error thrown, just empty result

---

### 16.6 Happy Path: Read Specific Line Range for Code Review

**Agent:** Developer Agent

**Prompt:**

```
I found an issue on line 15. Read lines 10-20 of /package.json so I can see the context
```

**Expected Behavior:**

- Agent reads the specific line range with context
- Returns `lines` object showing the actual range read
- Returns `totalLines` for reference

---

## 17. Edit File Tool Tests

These tests verify the `workspace_edit_file` tool with old_string/new_string replacement.

### 17.1 Happy Path: Replace Unique String

**Agent:** Developer Agent (or any agent with write access)

**Pre-condition:** Create a test file first:

```bash
echo "Hello World\nThis is a test file\nGoodbye World" > examples/unified-workspace/test-edit.txt
```

**Prompt:**

```
In /test-edit.txt, replace "Hello World" with "Greetings Earth"
```

**Expected Behavior:**

- Agent uses `workspace_edit_file` tool
- Replacement succeeds (string is unique)
- Returns success with replacements: 1

**Expected Tool Call:**

```json
{
  "tool": "workspace_edit_file",
  "args": {
    "path": "/test-edit.txt",
    "old_string": "Hello World",
    "new_string": "Greetings Earth"
  }
}
```

---

### 17.2 Failure Path: String Not Found

**Agent:** Developer Agent

**Pre-condition:** Use the test file from 17.1

**Prompt:**

```
In /test-edit.txt, replace "NONEXISTENT STRING xyz123" with "replacement"
```

**Expected Behavior:**

- Agent uses `workspace_edit_file` tool
- Tool returns error: string not found
- Agent reports the error to user

**Expected Error:**

```json
{
  "success": false,
  "message": "String not found in file: \"NONEXISTENT STRING xyz123\""
}
```

---

### 17.3 Failure Path: String Not Unique

**Agent:** Developer Agent

**Pre-condition:** Create a file with duplicate strings:

```bash
echo "hello hello hello\nworld" > examples/unified-workspace/test-duplicates.txt
```

**Prompt:**

```
In /test-duplicates.txt, replace "hello" with "hi"
```

**Expected Behavior:**

- Agent uses `workspace_edit_file` tool
- Tool returns error: string found multiple times
- Error suggests using `replace_all: true`

**Expected Error:**

```json
{
  "success": false,
  "message": "String found 3 times in file (must be unique, or use replace_all)"
}
```

---

### 17.4 Happy Path: Replace All Occurrences

**Agent:** Developer Agent

**Pre-condition:** Use the duplicates file from 17.3

**Prompt:**

```
In /test-duplicates.txt, replace ALL occurrences of "hello" with "hi"
```

**Expected Behavior:**

- Agent uses `workspace_edit_file` with `replace_all: true`
- All 3 occurrences replaced
- Returns success with replacements: 3

**Expected Tool Call:**

```json
{
  "tool": "workspace_edit_file",
  "args": {
    "path": "/test-duplicates.txt",
    "old_string": "hello",
    "new_string": "hi",
    "replace_all": true
  }
}
```

---

### 17.5 Happy Path: Multi-Line Replacement

**Agent:** Developer Agent

**Pre-condition:** Create a file with multi-line content:

```bash
cat > examples/unified-workspace/test-multiline.txt << 'EOF'
function old() {
  return "old";
}
EOF
```

**Prompt:**

```
In /test-multiline.txt, replace the function "old" with a function "new" that returns "new"
```

**Expected Behavior:**

- Agent uses `workspace_edit_file` with multi-line old_string and new_string
- Correctly replaces the entire function block

**Expected Tool Call (example):**

```json
{
  "tool": "workspace_edit_file",
  "args": {
    "path": "/test-multiline.txt",
    "old_string": "function old() {\n  return \"old\";\n}",
    "new_string": "function new() {\n  return \"new\";\n}"
  }
}
```

---

### 17.6 Approval Path: Edit File with FS Write Approval

**Agent:** FS Write Approval Agent

**Prompt:**

```
In /README.md, replace "# README" with "# Project README"
```

**Expected Behavior:**

1. Agent calls `workspace_edit_file`
2. **Approval dialog appears** (edit is a write operation)
3. User must approve/decline

**Expected UI:**

```
[Approval Required]
Tool: workspace_edit_file
Args: { "path": "/README.md", "old_string": "# README", "new_string": "# Project README" }
[Approve] [Decline]
```

---

### 17.7 Failure Path: Edit Non-Existent File

**Agent:** Developer Agent

**Prompt:**

```
In /nonexistent-file-xyz.txt, replace "foo" with "bar"
```

**Expected Behavior:**

- Agent uses `workspace_edit_file` tool
- Tool returns error: file not found

**Expected Error:**

```json
{
  "success": false,
  "message": "File not found: /nonexistent-file-xyz.txt"
}
```

---

### 17.8 Edge Case: Replace with Empty String (Delete)

**Agent:** Developer Agent

**Pre-condition:** Use test-edit.txt

**Prompt:**

```
In /test-edit.txt, remove the line "This is a test file" (replace it with nothing)
```

**Expected Behavior:**

- Agent uses `workspace_edit_file` with `new_string: ""`
- The matching text is deleted from the file
- Returns success

**Expected Tool Call:**

```json
{
  "tool": "workspace_edit_file",
  "args": {
    "path": "/test-edit.txt",
    "old_string": "This is a test file\n",
    "new_string": ""
  }
}
```

---

## 18. Skill Line-Range Tests

These tests verify line-range reading in skill tools (`skill-read-reference`, `skill-read-script`).

### 18.1 Happy Path: Read Reference with Line Range

**Agent:** Developer Agent or Documentation Agent

**Pre-condition:** Ensure a skill with reference files exists (e.g., code-review skill)

**Prompt:**

```
Activate the code-review skill, then read lines 1-10 of its main reference file
```

**Expected Behavior:**

1. Agent activates skill
2. Agent uses `skill-read-reference` with `startLine: 1, endLine: 10`
3. Returns content for lines 1-10 with `lines` and `totalLines` metadata

**Expected Tool Call:**

```json
{
  "tool": "skill-read-reference",
  "args": {
    "skillName": "code-review",
    "referencePath": "main.md",
    "startLine": 1,
    "endLine": 10
  }
}
```

---

### 18.2 Happy Path: Read Script with Line Range

**Agent:** Developer Agent

**Pre-condition:** Skill with script files

**Prompt:**

```
Activate the code-review skill and read lines 5-15 of one of its scripts
```

**Expected Behavior:**

- Agent uses `skill-read-script` with line range
- Returns partial content with line metadata

**Expected Tool Call:**

```json
{
  "tool": "skill-read-script",
  "args": {
    "skillName": "code-review",
    "scriptPath": "validate.js",
    "startLine": 5,
    "endLine": 15
  }
}
```

---

### 18.3 Happy Path: Read Reference Without Line Range

**Agent:** Developer Agent

**Prompt:**

```
Activate the code-review skill and read the entire main reference file
```

**Expected Behavior:**

- Agent uses `skill-read-reference` without startLine/endLine
- Returns full content with `lines: { start: 1, end: N }` and `totalLines: N`

---

### 18.4 Edge Case: Line Range Beyond File

**Agent:** Developer Agent

**Prompt:**

```
Activate the code-review skill and read lines 9999-10000 of its main reference
```

**Expected Behavior:**

- Agent uses `skill-read-reference` with out-of-bounds range
- Returns empty or partial content (no error)
- `lines` object reflects actual lines read

---

### 18.5 Happy Path: Use Line Range for Large File Navigation

**Agent:** Developer Agent

**Prompt:**

```
The code-review skill has a large reference file. First, read lines 1-20 to see the table of contents, then read lines 50-70 to see a specific section
```

**Expected Behavior:**

1. First call: `skill-read-reference` with `startLine: 1, endLine: 20`
2. Second call: `skill-read-reference` with `startLine: 50, endLine: 70`
3. Both return appropriate line ranges

---

## Line-Range and Edit File Test Matrix

### Model Comparison: gpt-4o-mini vs gpt-4o

| Test Case | Agent     | Expected Result              | gpt-4o-mini | gpt-4o   |
| --------- | --------- | ---------------------------- | ----------- | -------- |
| 16.1      | Developer | Read with line numbers       | [ ] Pass    | [ ] Pass |
| 16.2      | Developer | Offset and limit work        | [ ] Pass    | [ ] Pass |
| 16.3      | Developer | Read without line numbers    | [ ] Pass    | [ ] Pass |
| 16.5      | Developer | Offset beyond file length    | [ ] Pass    | [ ] Pass |
| 17.1      | Developer | Replace unique string        | [ ] Pass    | [ ] Pass |
| 17.2      | Developer | String not found error       | [ ] Pass    | [ ] Pass |
| 17.3      | Developer | String not unique error      | [ ] Pass    | [ ] Pass |
| 17.4      | Developer | Replace all occurrences      | [ ] Pass    | [ ] Pass |
| 17.5      | Developer | Multi-line replacement       | [ ] Pass    | [ ] Pass |
| 17.6      | FS Write  | Edit needs approval          | [ ] Pass    | [ ] Pass |
| 17.7      | Developer | Edit non-existent file error | [ ] Pass    | [ ] Pass |
| 18.1      | Developer | Skill reference line range   | [ ] Pass    | [ ] Pass |
| 18.2      | Developer | Skill script line range      | [ ] Pass    | [ ] Pass |
| 18.4      | Developer | Skill line range beyond file | [ ] Pass    | [ ] Pass |

---

## Cleanup After Line-Range and Edit Tests

```bash
cd examples/unified-workspace
rm -f test-edit.txt test-duplicates.txt test-multiline.txt
```

---

## 19. BM25 Search Tests

These tests verify the BM25 keyword search functionality via `workspace_search` and `workspace_index` tools.

**Note:** All workspaces in this example have `bm25: true` configured, enabling keyword search.

### 19.1 Happy Path: Search Indexed Content

**Agent:** Developer Agent

**Pre-condition:** Content is auto-indexed from `autoIndexPaths` on workspace init.

**Prompt:**

```
Search the workspace for "password reset"
```

**Expected Behavior:**

- Agent uses `workspace_search` tool
- Returns results from the indexed FAQ content
- Results include `score`, `lineRange`, and `content` preview

**Expected Tool Call:**

```json
{
  "tool": "workspace_search",
  "args": { "query": "password reset" }
}
```

---

### 19.2 Happy Path: Search with TopK Limit

**Agent:** Developer Agent

**Prompt:**

```
Search for "API" in the workspace and return only the top 3 results
```

**Expected Behavior:**

- Agent uses `workspace_search` with `topK: 3`
- Returns at most 3 results
- Results are ranked by relevance score

**Expected Tool Call:**

```json
{
  "tool": "workspace_search",
  "args": { "query": "API", "topK": 3 }
}
```

---

### 19.3 Happy Path: Index New Content

**Agent:** Developer Agent

**Prompt:**

```
Index this content for search: "Machine learning is a subset of AI" at path /ml-note.txt
```

**Expected Behavior:**

- Agent uses `workspace_index` tool
- Content is added to the BM25 index
- Subsequent searches for "machine learning" will find this content

**Expected Tool Call:**

```json
{
  "tool": "workspace_index",
  "args": { "path": "/ml-note.txt", "content": "Machine learning is a subset of AI" }
}
```

---

### 19.4 Happy Path: Search After Indexing

**Agent:** Developer Agent

**Prompt (after 19.3):**

```
Now search for "machine learning"
```

**Expected Behavior:**

- Agent uses `workspace_search`
- Results include the newly indexed `/ml-note.txt`
- Shows that dynamic indexing works

**Expected Tool Call:**

```json
{
  "tool": "workspace_search",
  "args": { "query": "machine learning" }
}
```

---

### 19.5 Happy Path: Search Returns Line Range

**Agent:** Developer Agent

**Prompt:**

```
Search for "billing" in the workspace
```

**Expected Behavior:**

- Results include `lineRange` showing which lines contain the match
- Useful for navigating to the exact location in a file

**Expected Output (example):**

```json
{
  "results": [
    {
      "id": "/.mastra-knowledge/knowledge/support/default/billing-cycle",
      "score": 2.5,
      "lineRange": { "start": 1, "end": 3 },
      "content": "..."
    }
  ]
}
```

---

### 19.6 Edge Case: Empty Search Results

**Agent:** Developer Agent

**Prompt:**

```
Search the workspace for "xyznonexistent12345abc"
```

**Expected Behavior:**

- Agent uses `workspace_search`
- Returns empty results array
- No error thrown

**Expected Response:**

```
No results found for "xyznonexistent12345abc"
```

---

### 19.7 Approval Path: Index with FS Write Approval

**Agent:** FS Write Approval Agent

**Prompt:**

```
Index this content: "Test content for approval" at path /test-index.txt
```

**Expected Behavior:**

1. Agent calls `workspace_index`
2. **Approval dialog appears** (indexing is a write operation)
3. User must approve/decline

**Expected UI:**

```
[Approval Required]
Tool: workspace_index
Args: { "path": "/test-index.txt", "content": "Test content for approval" }
[Approve] [Decline]
```

---

### 19.8 Happy Path: Search Without Approval (FS Write Approval)

**Agent:** FS Write Approval Agent

**Prompt:**

```
Search the workspace for "support"
```

**Expected Behavior:**

- Agent uses `workspace_search` tool
- **No approval dialog** (search is a read operation)
- Returns results

---

## 20. Vector and Hybrid Search Tests (Configuration Required)

**Note:** Vector search requires additional configuration not included in the default example:

```typescript
import { createOpenAI } from '@ai-sdk/openai';

const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });

const vectorWorkspace = new Workspace({
  filesystem: new LocalFilesystem({ basePath: './data' }),
  bm25: true,
  vectorStore: yourVectorStore, // e.g., Chroma, Pinecone, etc.
  embedder: async text => {
    const { embedding } = await embed({
      model: openai.embedding('text-embedding-3-small'),
      value: text,
    });
    return embedding;
  },
});
```

### 20.1 Vector Search (Requires Configuration)

**Pre-condition:** Workspace configured with `vectorStore` and `embedder`.

**Prompt:**

```
Search for documents semantically similar to "how do I change my subscription"
```

**Expected Behavior:**

- Agent uses `workspace_search` with `mode: 'vector'`
- Returns semantically similar results (not just keyword matches)
- Results include similarity scores

---

### 20.2 Hybrid Search (Requires Configuration)

**Pre-condition:** Workspace configured with both `bm25: true` AND `vectorStore` + `embedder`.

**Prompt:**

```
Search for "password" using hybrid search with 70% vector weight
```

**Expected Behavior:**

- Agent uses `workspace_search` with `mode: 'hybrid', vectorWeight: 0.7`
- Combines keyword matching (30%) with semantic similarity (70%)
- Results include `scoreDetails` showing both scores

**Expected Tool Call:**

```json
{
  "tool": "workspace_search",
  "args": { "query": "password", "mode": "hybrid", "vectorWeight": 0.7 }
}
```

---

### 20.3 Mode Selection (Requires Configuration)

**Pre-condition:** Workspace configured with both BM25 and vector.

**Prompt:**

```
First, search for "authentication" using BM25 only. Then search again using vector only.
```

**Expected Behavior:**

1. First search: `mode: 'bm25'` - keyword matching only
2. Second search: `mode: 'vector'` - semantic similarity only
3. Different results demonstrating the difference between modes

---

## Search Test Matrix

### BM25 Search: gpt-4o-mini vs gpt-4o

| Test Case | Agent            | Expected Result         | gpt-4o-mini | gpt-4o   |
| --------- | ---------------- | ----------------------- | ----------- | -------- |
| 19.1      | Developer        | Search returns results  | [ ] Pass    | [ ] Pass |
| 19.2      | Developer        | TopK limit respected    | [ ] Pass    | [ ] Pass |
| 19.3      | Developer        | Index new content       | [ ] Pass    | [ ] Pass |
| 19.4      | Developer        | Search finds indexed    | [ ] Pass    | [ ] Pass |
| 19.5      | Developer        | LineRange in results    | [ ] Pass    | [ ] Pass |
| 19.6      | Developer        | Empty results handled   | [ ] Pass    | [ ] Pass |
| 19.7      | FS Write Approve | Index needs approval    | [ ] Pass    | [ ] Pass |
| 19.8      | FS Write Approve | Search without approval | [ ] Pass    | [ ] Pass |

### Vector/Hybrid Search (Configuration Required)

| Test Case | Agent     | Expected Result      | gpt-4o-mini | gpt-4o   |
| --------- | --------- | -------------------- | ----------- | -------- |
| 20.1      | Developer | Vector search works  | [ ] Pass    | [ ] Pass |
| 20.2      | Developer | Hybrid search works  | [ ] Pass    | [ ] Pass |
| 20.3      | Developer | Mode selection works | [ ] Pass    | [ ] Pass |
