---
'@mastra/core': minor
'mastracode': patch
---

Added permission pattern allowlist as an alternative to full YOLO mode. Commands matching allow patterns auto-approve, deny patterns auto-block, and everything else prompts as usual.

**Why**

YOLO mode is all-or-nothing. Prompting for every safe command pushes users toward full YOLO, which also approves destructive commands. A per-pattern allowlist gives YOLO ergonomics for routine operations while preserving approval gates for dangerous commands.

**@mastra/core:** Added `PermissionPatternRule` type and optional `patterns` field to `PermissionRules`. `resolveToolApproval` now accepts tool args and matches them against glob patterns. Deny patterns are checked before allow patterns.

**mastracode:** Added `permissions` settings block with `allow`/`deny` arrays. The `/permissions` command displays active pattern rules.

```json
{
  "permissions": {
    "allow": ["Bash(git status*)", "Bash(git diff*)", "Bash(echo*)"],
    "deny": ["Bash(rm -rf*)", "Bash(git push --force*)"]
  }
}
```
