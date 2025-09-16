# Fast Development Guide for Mastra Docs

## The Problem

The Mastra docs site is slow in development because:

1. It processes both English and Japanese translations
2. MDX compilation with syntax highlighting is computationally expensive
3. The site has hundreds of documentation pages
4. Nextra doesn't work well with Turbopack (Next.js's faster bundler)

## Current Status

Unfortunately, due to the architecture of Nextra + i18n + MDX, there's a fundamental limitation on how fast the initial compilation can be. The optimizations I've created help with:

- Server startup time: ~1-2 seconds (improved)
- But initial page compilation still takes 30-120+ seconds due to MDX processing

## Workarounds for Faster Development

### 1. **Use Hot Module Replacement (HMR)**

Once the initial compilation is done, subsequent edits are much faster:

- Start the dev server and wait for initial compilation
- Keep it running while you work
- Changes to MDX files will hot reload in 1-3 seconds

### 2. **Work on Specific Sections**

If you're only editing a few pages, you can temporarily move other content:

```bash
# Move unused sections temporarily
mv src/content/en/docs/integrations src/content/en/docs/.integrations-backup
mv src/content/ja src/content/.ja-backup

# Work on your section
npm run dev

# Restore when done
mv src/content/en/docs/.integrations-backup src/content/en/docs/integrations
mv src/content/.ja-backup src/content/ja
```

### 3. **Use a Minimal Test File**

Create a test page for quick iterations:

```bash
# Create a test page
echo "# Test Page\n\nYour content here" > src/content/en/docs/test.mdx

# Edit this file for quick testing
# Then copy content to the real file when ready
```

### 4. **Alternative: Use Markdown Preview**

For pure content editing without testing components:

- Use VS Code with a Markdown preview extension
- Edit MDX files directly and preview in VS Code
- Only run the dev server when you need to test interactive features

## Available Scripts

```bash
# Standard development (with all features, slower)
npm run dev

# Development without translations (slightly faster)
npm run dev:fast

# Original full-featured mode
npm run dev:original
```

## The Reality

With the current Nextra + i18n setup, the initial compilation will be slow (30-120+ seconds). This is a known limitation of processing large MDX documentation sites. The best workflow is:

1. Start the dev server once at the beginning of your session
2. Keep it running throughout your work
3. Use HMR for fast updates (1-3 seconds per change)
4. Consider temporarily removing content you're not working on

## Future Improvements

Consider migrating to:

- **Astro** with MDX - Much faster dev builds
- **VitePress** - Optimized for documentation sites
- **Docusaurus** - Better performance for large sites
- Custom Next.js setup without Nextra - More control over optimization

These alternatives would provide 5-10x faster initial build times while maintaining similar features.
