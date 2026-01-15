# LongMemEval Investigation Workflow

This document describes how to investigate failing questions in LongMemEval benchmarks to identify root causes and implement fixes.

## Overview

The investigation workflow has 4 stages:

```
pending → investigated → fix-implemented → synced
```

1. **pending**: Initial state for all failed questions
2. **investigated**: Root cause identified and documented
3. **fix-implemented**: Fix has been applied (Observer/Reflector prompt, improved Q/A, etc.)
4. **synced**: Changes synced to `longmemeval_s.json` dataset

## Quick Start

```bash
# 1. List all runs with failures
pnpm investigate --list

# 2. Setup investigation for a specific run
pnpm investigate <run-id>

# 3. Open the next uninvestigated question
pnpm investigate --next

# 4. After investigating, mark as done
pnpm investigate --done <question-id>

# 5. After implementing fix, mark as fixed
pnpm investigate --fixed <question-id>

# 6. Sync all fixes to dataset
pnpm investigate --sync
```

## Detailed Workflow

### Step 1: Find Failures to Investigate

```bash
# List all runs with failures, grouped by config
pnpm investigate --list

# Filter by config name
pnpm investigate --list -c gpt5
pnpm investigate --list -c om-gemini
```

### Step 2: Setup Investigation

```bash
# Setup investigation directory for a run
pnpm investigate run_1768439350043
```

This creates:
```
investigations/
└── run_1768439350043/
    ├── progress.json           # Tracks investigation status
    └── <question-id>/
        ├── analysis.md         # Investigation template
        └── data/
            ├── original.json   # Raw dataset for this question
            ├── result.json     # Evaluation result
            ├── om.md           # Agent's context window
            └── om.json         # Prepared OM data (if exists)
```

### Step 3: Investigate Each Question

```bash
# Open the next uninvestigated question in your editor
pnpm investigate --next

# Check current progress
pnpm investigate --status
```

#### Investigation Utilities

The `investigate` command provides several utilities to help diagnose issues:

##### Search Observations
```bash
# Search what the Observer extracted
pnpm investigate --search "keyword" -q <question-id>
```

##### Search Original Dataset
```bash
# Search the raw dataset with full context
pnpm investigate --search-original "keyword" -q <question-id>
```

##### Trace Information Flow
```bash
# Trace a keyword through the entire pipeline
pnpm investigate --trace "keyword" -q <question-id>
```

This shows where information exists at each stage:
- Original dataset sessions
- Stored messages (om.json)
- Extracted observations
- Agent context (om.md)

##### View Sessions
```bash
# List all sessions for a question
pnpm investigate --list-sessions -q <question-id>

# View a specific session
pnpm investigate --session 33 -q <question-id>
```

##### Inspect Question Data
```bash
# Show summary of question's data
pnpm investigate --inspect <question-id>
```

##### View by Date
```bash
# View observations around a specific date
pnpm investigate --date "2023/05/29" -q <question-id>
pnpm investigate --date "May 29" -q <question-id> --context 2
```

### Step 4: Document Findings

Edit the `analysis.md` file for each question:

```markdown
## Failure Category
- [x] Observer missed critical information
- [ ] Reflector lost/merged information incorrectly
- [ ] Agent reasoning error (had info, wrong conclusion)
- [ ] Ambiguous/poorly-worded question
- [ ] Dataset inconsistency/error
- [ ] RAG retrieval miss (if applicable)
- [ ] Other: ___

## Root Cause Analysis
<!-- Describe what went wrong -->

## Evidence
<!-- Quote relevant parts of om.md, original data, etc. -->

## Potential Improvements
### Observer/Reflector Changes
- **Likelihood**: High
- **Suggested prompt change**: ...

### Fixed Question/Answer
- **improved_question**: ...
- **improved_answer**: ...
- **improvement_note**: ...
```

### Step 5: Mark as Investigated

```bash
pnpm investigate --done <question-id>
```

This:
- Extracts the failure category from `analysis.md`
- Updates `progress.json`
- Shows remaining count

### Step 6: Implement Fixes

Based on your investigation, implement fixes:

1. **Observer/Reflector prompt changes**: Edit `packages/memory/src/experiments/observational-memory/observer-agent.ts` or `reflector-agent.ts`

2. **Improved question/answer**: Add to `analysis.md`:
   ```markdown
   ### Fixed Question/Answer
   - **improved_question**: What is the current location of my old sneakers?
   - **improved_answer**: in a shoe rack in my closet
   - **improvement_note**: Original question was ambiguous about timeframe
   ```

3. **Re-prepare data**: If Observer/Reflector prompts changed:
   ```bash
   pnpm prepare om --from-failures ./results/om/run_xxx/failures.json
   ```

### Step 7: Mark as Fixed

```bash
pnpm investigate --fixed <question-id>
```

### Step 8: Sync to Dataset

```bash
pnpm investigate --sync
```

This syncs `improved_question`, `improved_answer`, and `improvement_note` from `analysis.md` files to `longmemeval_s.json`.

## Common Failure Categories

### Observer Missed Information
**Symptoms**: Information exists in original dataset but not in observations.

**Diagnosis**:
```bash
pnpm investigate --trace "keyword" -q <question-id>
# Look for: "❌ Observer missed this information"
```

**Common causes**:
- Statement of intent misclassified as question
- Information buried in long message
- Implicit information not captured

### Reflector Lost Information
**Symptoms**: Information in observations but lost after reflection.

**Diagnosis**: Compare observations before/after reflection in `om.json`.

### Agent Reasoning Error
**Symptoms**: Information present in `om.md` but agent reached wrong conclusion.

**Diagnosis**: Check `om.md` - if the answer is there, it's a reasoning issue.

### Dataset Inconsistency
**Symptoms**: Conflicting information in the dataset itself.

**Diagnosis**:
```bash
pnpm investigate --search-original "keyword" -q <question-id>
# Look for contradictory statements
```

## Tips

1. **Start with `--trace`**: It quickly shows where information was lost.

2. **Use `--search-original`**: See the full context of what the user actually said.

3. **Check the date**: Use `--list-sessions` to find when information was mentioned.

4. **Look for patterns**: Similar failures often have the same root cause.

5. **Document everything**: Good `analysis.md` files help identify systemic issues.

## Example Investigation

```bash
# 1. Find the question
pnpm investigate --list -c om

# 2. Setup
pnpm investigate run_1768439350043

# 3. Start investigating
pnpm investigate --next

# 4. Trace the issue
pnpm investigate --trace "shoe rack" -q 07741c45

# 5. Search original data
pnpm investigate --search-original "shoe rack" -q 07741c45

# 6. View the session
pnpm investigate --session 33 -q 07741c45

# 7. Document findings in analysis.md
# (edit the file)

# 8. Mark as done
pnpm investigate --done 07741c45

# 9. After implementing fix
pnpm investigate --fixed 07741c45

# 10. Sync to dataset
pnpm investigate --sync
```
