#!/usr/bin/env python3
"""Validate best-practice skill catalogs against canonical rule files."""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

SKILLS = {
    "react-best-practices": "references/react-best-practices-reference.md",
    "tailwind-best-practices": "references/tailwind-best-practices-reference.md",
}

REQUIRED_FRONTMATTER = ("title", "impact", "impactDescription", "tags")
FORBIDDEN_CATALOG_PATTERNS = (
    "```",
    "**Incorrect",
    "**Correct",
    "Incorrect (",
    "Correct (",
)


def parse_frontmatter(path: Path) -> dict[str, str]:
    text = path.read_text()
    if not text.startswith("---\n"):
        raise ValueError(f"{path}: missing YAML frontmatter")

    try:
        raw_frontmatter = text.split("---\n", 2)[1]
    except IndexError as exc:
        raise ValueError(f"{path}: malformed YAML frontmatter") from exc

    meta: dict[str, str] = {}
    for line in raw_frontmatter.splitlines():
        if ": " in line:
            key, value = line.split(": ", 1)
            meta[key] = value

    missing = [key for key in REQUIRED_FRONTMATTER if not meta.get(key)]
    if missing:
        raise ValueError(f"{path}: missing frontmatter keys: {', '.join(missing)}")

    return meta


def validate_skill(skill_name: str, catalog_relative_path: str) -> list[str]:
    errors: list[str] = []
    skill_dir = ROOT / ".claude" / "skills" / skill_name
    skill_file = skill_dir / "SKILL.md"
    catalog_path = skill_dir / catalog_relative_path
    rules_dir = skill_dir / "references" / "rules"

    if "Complete guide" in skill_file.read_text():
        errors.append(f"{skill_file}: should point to the catalog and canonical rule files, not a complete guide")

    catalog = catalog_path.read_text()
    for pattern in FORBIDDEN_CATALOG_PATTERNS:
        if pattern in catalog:
            errors.append(f"{catalog_path}: catalog must not contain duplicated examples or code fences ({pattern!r})")

    rule_paths = sorted(rules_dir.glob("*.md"))
    if not rule_paths:
        errors.append(f"{rules_dir}: no rule files found")
        return errors

    catalog_rule_refs = re.findall(r"`(references/rules/[A-Za-z0-9_.-]+\.md)`", catalog)
    expected_refs = [f"references/rules/{path.name}" for path in rule_paths]

    missing_refs = sorted(set(expected_refs) - set(catalog_rule_refs))
    extra_refs = sorted(set(catalog_rule_refs) - set(expected_refs))
    duplicate_refs = sorted(ref for ref in set(catalog_rule_refs) if catalog_rule_refs.count(ref) > 1)

    for ref in missing_refs:
        errors.append(f"{catalog_path}: missing catalog entry for {ref}")
    for ref in extra_refs:
        errors.append(f"{catalog_path}: references missing rule file {ref}")
    for ref in duplicate_refs:
        errors.append(f"{catalog_path}: duplicate catalog entry for {ref}")

    for rule_path in rule_paths:
        try:
            meta = parse_frontmatter(rule_path)
        except ValueError as exc:
            errors.append(str(exc))
            continue

        relative_ref = f"references/rules/{rule_path.name}"
        if relative_ref not in catalog:
            continue

        if meta["title"] not in catalog:
            errors.append(f"{catalog_path}: missing title for {relative_ref}: {meta['title']}")
        if meta["impact"] not in catalog:
            errors.append(f"{catalog_path}: missing impact for {relative_ref}: {meta['impact']}")

    return errors


def main() -> int:
    errors: list[str] = []
    for skill_name, catalog_relative_path in SKILLS.items():
        errors.extend(validate_skill(skill_name, catalog_relative_path))

    if errors:
        for error in errors:
            print(error, file=sys.stderr)
        return 1

    print("Best-practice skill catalogs are in sync with canonical rule files.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
