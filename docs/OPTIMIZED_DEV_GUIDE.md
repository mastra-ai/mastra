# Optimized Development Guide for Mastra Docs

## Quick Start

```bash
# Use the cached configuration for best performance
npm run dev:cached
```

## Performance Results

With the optimized configuration (`dev:cached`):

- **Server startup**: ~1.2 seconds ✅
- **First page compilation**: ~80-120 seconds (unavoidable with MDX)
- **Subsequent NEW pages**: ~2-3 seconds ✅
- **Already visited pages**: ~0.5-1 second ✅

## How It Works

The optimized configuration (`next.config.cached.mjs`) includes:

1. **Aggressive Memory Caching**: Webpack caches modules in memory
2. **English-Only Mode**: Skips Japanese translation processing
3. **Simplified MDX**: Uses simpler syntax highlighting theme
4. **On-Demand Compilation**: Pages compile only when visited
5. **Page Memory Cache**: Keeps 10 recently visited pages in memory for 5 minutes

## The Key Insight

The issue isn't that pages recompile on every refresh - they don't! The problem is the **initial compilation** of each new page takes a long time due to MDX processing. But once compiled:

- Pages stay in memory for 5 minutes
- Returning to a page is nearly instant (< 1 second)
- Hot module replacement works well for edits

## Recommended Workflow

1. **Start the dev server once**: `npm run dev:cached`
2. **Accept the initial wait**: First page will take 80-120 seconds
3. **Keep server running**: Don't restart unless necessary
4. **Navigate normally**: After initial load, navigation is fast
5. **Edit files**: HMR updates in 1-3 seconds

## Available Scripts

```bash
# Best option - with caching optimizations
npm run dev:cached

# Alternative - basic optimizations
npm run dev:fast

# Original - with all features
npm run dev:original
```

## Tips for Faster Development

### 1. Pre-warm Common Pages

After starting the dev server, open the pages you'll be working on in browser tabs. They'll compile once and stay fast.

### 2. Use Browser Tabs

Keep multiple tabs open for different sections. Switching tabs is instant since pages stay in memory.

### 3. Avoid Server Restarts

The cache is lost on restart. Keep the server running throughout your work session.

### 4. Edit in Place

Use HMR for quick iterations. Save your MDX file and see changes in 1-3 seconds.

## Configuration Files

- `next.config.cached.mjs` - Optimized config with aggressive caching
- `next.config.fast-en.mjs` - English-only config
- `next.config.original.mjs` - Original production config

## Why Initial Compilation is Slow

MDX processing involves:

- Parsing markdown and JSX
- Syntax highlighting for code blocks
- Component resolution
- Bundling with webpack

This is computationally expensive and happens for EACH page on first visit. The optimizations help with caching but can't eliminate the initial processing time.

## Future Improvements

Consider:

- **Static generation**: Pre-build all pages with `next build`
- **Different framework**: Astro or VitePress for faster MDX
- **Simpler docs**: Remove complex MDX features if not needed
