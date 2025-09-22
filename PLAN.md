# Documentation Migration Plan: Legacy to VNext APIs

## Overview

This plan outlines the documentation updates required for the breaking change where:

- `stream()` → `streamLegacy()`
- `generate()` → `generateLegacy()`
- `streamVNext()` → `stream()`
- `generateVNext()` → `generate()`

## Timeline

- **Deprecation Date**: September 23rd, 2025 (as mentioned in code)
- **Documentation Update**: Prior to release

## Migration Strategy

### Phase 1: Update Core Reference Documentation

Update the main reference documentation to reflect the new API structure while maintaining backward compatibility documentation.

### Phase 2: Update Examples

Update all code examples to use the new APIs where appropriate, with migration notes for users on legacy versions.

### Phase 3: Update Guides and Tutorials

Update all guides, tutorials, and course content to use the new APIs.

## Execution Order

To minimize confusion and ensure clean updates:

### Step 1: Create Legacy Documentation

1. Copy current `generate.mdx` → `generateLegacy.mdx`
2. Copy current `stream.mdx` → `streamLegacy.mdx`
3. Add deprecation notices to legacy pages
4. Update legacy page titles and descriptions
5. Update navigation to include legacy pages

### Step 2: Update Main Documentation

1. Copy content from `generateVNext.mdx` → `generate.mdx`
2. Copy content from `streamVNext.mdx` → `stream.mdx`
3. Remove experimental tags and warnings
4. Update all internal references

### Step 3: Setup Redirects

1. Add all redirects to `next.config.mjs`
2. Test redirect functionality

### Step 4: Clean Up

1. Delete VNext files
2. Update all cross-references in other documentation
3. Update code examples throughout docs

### Step 5: Update Examples

. Update example projects to use new APIs
. Add comments about version compatibility where needed

### Step 6: Review Code Examples in Documentation

. Review all code examples in documentation files to ensure they follow the migration guide
. Check that examples use the correct methods based on model version context
. Ensure consistency across all documentation examples

### Step 7: Final Review

1. Search for any remaining "generateVNext" or "streamVNext" references
2. Verify all links work
3. Test documentation build

## Documentation Pages to Update

### 1. Core Agent Reference Pages (High Priority)

#### English Documentation

- [x] `/docs/src/content/en/reference/agents/generate.mdx` - Convert to document new `generate()` (formerly `generateVNext`)
- [x] `/docs/src/content/en/reference/agents/generateLegacy.mdx` - NEW: Create page for legacy `generate()` method, copy contents from existing generate page
- [x] `/docs/src/content/en/reference/agents/generateVNext.mdx` - redirect to new `generate.mdx`
- [x] `/docs/src/content/en/reference/streaming/agents/stream.mdx` - Convert to document new `stream()` (formerly `streamVNext`)
- [x] `/docs/src/content/en/reference/streaming/agents/streamLegacy.mdx` - NEW: Create page for legacy `stream()` method
- [x] `/docs/src/content/en/reference/streaming/agents/streamVNext.mdx` - redirect to new `stream.mdx`
- [x] `/docs/src/content/en/reference/agents/migration-guide.mdx` - Update to reflect the actual migration (not experimental)
- [x] `/docs/src/content/en/reference/agents/_meta.tsx` - Update navigation structure

#### Japanese Documentation (Same changes as English)

Ignore, this is auto generated from en

### 2. Workflow Reference Pages

#### English Documentation

- [ ] `/docs/src/content/en/reference/workflows/run.mdx` - Update method references
- [ ] `/docs/src/content/en/reference/workflows/run-methods/stream.mdx` - Convert to new API
- [ ] `/docs/src/content/en/reference/workflows/run-methods/streamLegacy.mdx` - NEW
- [ ] `/docs/src/content/en/reference/workflows/run-methods/streamVNext.mdx` - Remove/redirect
- [ ] `/docs/src/content/en/reference/streaming/workflows/stream.mdx`
- [ ] `/docs/src/content/en/reference/streaming/workflows/streamLegacy.mdx` - NEW
- [ ] `/docs/src/content/en/reference/streaming/workflows/streamVNext.mdx` - Remove/redirect
- [ ] `/docs/src/content/en/reference/streaming/workflows/resumeStreamVNext.mdx` - Update to `resumeStream.mdx`

### 3. Supporting Type Documentation

#### English Documentation

- [ ] `/docs/src/content/en/reference/streaming/agents/MastraModelOutput.mdx` - Update references from streamVNext to stream
- [ ] `/docs/src/content/en/reference/streaming/ChunkType.mdx` - Update references

### 4. Tool Documentation (Update Examples)

#### English Documentation

- [ ] `/docs/src/content/en/reference/tools/vector-query-tool.mdx` - Update code examples
- [ ] `/docs/src/content/en/reference/tools/mcp-configuration.mdx` - Update code examples
- [ ] `/docs/src/content/en/reference/tools/mcp-client.mdx` - Update code examples
- [ ] `/docs/src/content/en/reference/tools/client.mdx` - Update code examples
- [ ] `/docs/src/content/en/reference/tools/graph-rag-tool.mdx` - Update code examples

### 5. Client SDK Documentation

#### English Documentation

- [x] `/docs/src/content/en/reference/client-js/agents.mdx` - Update all method references
- [x] `/docs/src/content/en/reference/client-js/workflows.mdx` - Update stream references
- [x] `/docs/src/content/en/reference/client-js/error-handling.mdx` - Update examples

### 6. Memory Documentation

#### English Documentation

- [x] `/docs/src/content/en/reference/memory/createThread.mdx` - Update examples

### 7. Guide and Tutorial Updates

- [x] Search and update any guides that reference these methods
- [x] Update course content if applicable
- [x] Update getting started guides

### 8. Example Code Updates

Update example projects to use new APIs:

- [x] `examples/client-side-tools/`
- [x] `examples/memory-with-context/`
- [x] `examples/basics/agents/`
- [x] `examples/basics/evals/`
- [x] `examples/basics/rag/`
- [x] `examples/basics/scorers/`
- [x] Other examples as identified (workflows-legacy uses LegacyWorkflow/LegacyStep correctly)

## Key Changes for Each Page Type

### For Main Method Pages (generate/stream)

1. Remove "Experimental" tags
2. Update method signatures
3. Remove deprecation warnings about VNext
4. Update all code examples
5. Add migration notice pointing to legacy methods for users who need them
6. Update return type documentation

### For New Legacy Pages

1. Add deprecation warning at top
2. Copy current content from existing pages
3. Add migration guide section pointing to new methods
4. Mark as "Legacy" in title and throughout

### For Migration Guide

1. Update to reflect actual migration (not experimental preview)
2. Add timeline information
3. Include automatic detection notes about V1/V2 models
4. Provide clear before/after examples

### For Supporting Pages (types, tools, etc.)

1. Update all method references in code examples
2. Update any inline documentation
3. Ensure consistency with new naming

## Version Compatibility Notes

### Important Considerations

1. **Model Version Detection**: The framework automatically detects V1 vs V2 models
2. **V1 Models**: Will only work with `generateLegacy()` and `streamLegacy()`
3. **V2 Models**: Will only work with new `generate()` and `stream()`
4. **Error Handling**: Clear error messages when wrong method is used with model version

### Documentation Must Emphasize

- Automatic model version detection
- Clear compatibility matrix (which methods work with which model versions)
- Migration path for users with V1 models
- Benefits of upgrading to V2 models

## Search and Replace Guidelines

### Primary Replacements

- Existing `.generate(` → `.generateLegacy(` (where documenting legacy)
- Existing `.stream(` → `.streamLegacy(` (where documenting legacy)
- `.generateVNext(` → `.generate(`
- `.streamVNext(` → `.stream(`

note that using actual global search/replace is probably not the best idea, we should likely only use global search to validate our understanding of what's remaining, not do search/replaces globally.
If we start with moving to legacy then globally we should have none of the original generate( and stream( text,
at which point we can then globally search for the vnext variants and update those

### Navigation and Titles

- "generateVNext" in titles → "generate"
- "streamVNext" in titles → "stream"
- Remove "(Experimental)" tags from VNext references
- Add "(Legacy)" tags to old method references

## Testing Checklist

- [ ] All documentation builds without errors
- [ ] Navigation structure is correct
- [ ] All code examples are syntactically correct
- [ ] Cross-references between pages work
- [ ] Migration guide provides clear path forward
- [ ] Both English and Japanese docs are synchronized

## File Operations

### Files to Delete (After Adding Redirects)

- `/docs/src/content/en/reference/agents/generateVNext.mdx`
- `/docs/src/content/en/reference/streaming/agents/streamVNext.mdx`
- `/docs/src/content/en/reference/workflows/run-methods/streamVNext.mdx`
- `/docs/src/content/en/reference/streaming/workflows/streamVNext.mdx`
- `/docs/src/content/en/reference/streaming/workflows/resumeStreamVNext.mdx`

### Files to Create (New Legacy Documentation)

- `/docs/src/content/en/reference/agents/generateLegacy.mdx` - Copy from current generate.mdx
- `/docs/src/content/en/reference/streaming/agents/streamLegacy.mdx` - Copy from current stream.mdx
- `/docs/src/content/en/reference/workflows/run-methods/streamLegacy.mdx` - Copy from current stream.mdx
- `/docs/src/content/en/reference/streaming/workflows/streamLegacy.mdx` - Copy from current stream.mdx

### Files to Rename

- `/docs/src/content/en/reference/streaming/workflows/resumeStreamVNext.mdx` → `resumeStream.mdx`

## Redirects Required

### Next.js Redirects Configuration

Add to `docs/next.config.mjs` redirects array:

#### Agent Method Redirects

```javascript
// VNext to new standard methods
{ source: '/reference/agents/generateVNext', destination: '/reference/agents/generate', permanent: true },
{ source: '/reference/streaming/agents/streamVNext', destination: '/reference/streaming/agents/stream', permanent: true },

// Japanese versions (if paths exist)
{ source: '/ja/reference/agents/generateVNext', destination: '/ja/reference/agents/generate', permanent: true },
{ source: '/ja/reference/streaming/agents/streamVNext', destination: '/ja/reference/streaming/agents/stream', permanent: true },
```

#### Workflow Method Redirects

```javascript
// Workflow VNext redirects
{ source: '/reference/workflows/run-methods/streamVNext', destination: '/reference/workflows/run-methods/stream', permanent: true },
{ source: '/reference/streaming/workflows/streamVNext', destination: '/reference/streaming/workflows/stream', permanent: true },
{ source: '/reference/streaming/workflows/resumeStreamVNext', destination: '/reference/streaming/workflows/resumeStream', permanent: true },

// Japanese versions
{ source: '/ja/reference/workflows/run-methods/streamVNext', destination: '/ja/reference/workflows/run-methods/stream', permanent: true },
{ source: '/ja/reference/streaming/workflows/streamVNext', destination: '/ja/reference/streaming/workflows/stream', permanent: true },
{ source: '/ja/reference/streaming/workflows/resumeStreamVNext', destination: '/ja/reference/streaming/workflows/resumeStream', permanent: true },
```

### URL Structure Changes

- All URLs containing `generateVNext` → redirect to `generate`
- All URLs containing `streamVNext` → redirect to `stream`
- No redirects needed for legacy methods (they're new pages)

### Cross-Reference Updates

Pages that link to VNext methods need their links updated:

- Update all `[.generateVNext()]` links to `[.generate()]`
- Update all `[.streamVNext()]` links to `[.stream()]`
- Update all href="/reference/agents/generateVNext" to href="/reference/agents/generate"
- Update all href="/reference/streaming/agents/streamVNext" to href="/reference/streaming/agents/stream"

### Anchor Links

Check for any anchor links that might break:

- `#generatevnext` → `#generate`
- `#streamvnext` → `#stream`

## Notes

- The migration guide draft already exists and provides good foundation
- The SUMMARY.md file contains detailed technical information that should inform documentation updates
- Maintain backward compatibility documentation for users who cannot immediately migrate
- Consider adding a banner/notice on legacy pages directing users to new methods
- Japanese documentation is auto-generated from English, so we only need to update English docs
