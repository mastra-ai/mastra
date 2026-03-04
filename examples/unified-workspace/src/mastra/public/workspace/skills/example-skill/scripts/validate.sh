#!/bin/bash
# Validates a skill directory structure
set -euo pipefail

SKILL_DIR="${1:-.}"

if [ ! -f "$SKILL_DIR/SKILL.md" ]; then
  echo "ERROR: Missing SKILL.md"
  exit 1
fi

# Check frontmatter
if ! head -1 "$SKILL_DIR/SKILL.md" | grep -q "^---$"; then
  echo "ERROR: SKILL.md must start with YAML frontmatter (---)"
  exit 1
fi

# Check required fields
if ! grep -q "^name:" "$SKILL_DIR/SKILL.md"; then
  echo "ERROR: Missing 'name' in frontmatter"
  exit 1
fi

if ! grep -q "^description:" "$SKILL_DIR/SKILL.md"; then
  echo "ERROR: Missing 'description' in frontmatter"
  exit 1
fi

echo "OK: Skill structure is valid"
