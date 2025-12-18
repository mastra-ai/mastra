# Link Conversion Script

This directory contains a script to convert all absolute internal links to relative file paths in the reference section.

## How to Run

```bash
cd /Users/booker/Code/mastra/docs
node convert_all_links.mjs
```

##What It Does

The script processes all MDX files in `src/content/en/reference/` and converts absolute internal links to relative paths.

### URL-to-Directory Mapping:
- `/docs/v1/` → `docs/`
- `/reference/v1/` → `reference/`
- `/guides/v1/` → `guides/`
- `/models/v1/` → `models/`
- `/examples/v1/` → `examples/`

### Conversion Examples:

For a file at `reference/memory/memory-class.mdx`:
- `/docs/v1/memory/overview` → `../../docs/memory/overview`
- `/reference/v1/memory/createThread` → `./createThread`
- `/reference/v1/core/mastra-class` → `../core/mastra-class`

For a file at `reference/core/mastra-class.mdx`:
- `/docs/v1/agents/overview` → `../../docs/agents/overview`
- `/reference/v1/core/getAgent` → `./getAgent`
- `/reference/v1/memory/memory-class` → `../memory/memory-class`

The script:
1. Preserves hash anchors (e.g., `#section`)
2. Skips external URLs (http://, https://)
3. Removes file extensions from paths
4. Only modifies files that contain absolute internal links

## Script Location

The conversion script is located at: `convert_all_links.mjs`

## Files Processed

The script processes approximately 160 MDX files in the reference directory with absolute links that need conversion.

## Manual Verification

After running the script, you may want to spot-check a few converted files to ensure the links are correct:

```bash
# Example files to check:
cat src/content/en/reference/memory/memory-class.mdx | grep "](\./"
cat src/content/en/reference/core/mastra-class.mdx | grep "](\./"
```
