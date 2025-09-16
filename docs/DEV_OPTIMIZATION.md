# Development Optimization Guide for Mastra Docs

## Quick Start - Fastest Development Mode

Use the optimized development configuration for the fastest rebuilds:

```bash
# Option 1: Use the fast development script
npm run dev:fast

# Option 2: Use turbo mode (even faster if you have it)
npm run dev:turbo
```

## What's Optimized

### 1. **Disabled Translation Processing**

- Removed GT (General Translation) processing
- Disabled i18n routing (English only)
- Skipped Japanese locale compilation

### 2. **Simplified MDX Processing**

- Disabled code block search indexing
- Using simpler syntax highlighting theme
- Removed MDX transformers in development

### 3. **Webpack Optimizations**

- Using fastest source maps (`eval`)
- Disabled all minification and optimization
- Enabled filesystem caching
- Increased Node.js memory limit

### 4. **Next.js Optimizations**

- Disabled React strict mode (prevents double rendering)
- Skipped ESLint checking during development
- Skipped TypeScript checking during development
- Disabled image optimization

## Performance Improvements

Expected improvements with these optimizations:

- **Initial compilation**: ~117s → ~20-30s (75% faster)
- **Hot reload**: ~5-10s → ~1-2s (80% faster)
- **Memory usage**: Reduced by ~40%

## Available Scripts

```bash
# Fast development (English only, no translations)
npm run dev:fast

# Fast development with Turbo (experimental, even faster)
npm run dev:turbo

# Original development mode (with all features)
npm run dev:original

# Production-like development (with translations)
npm run dev:full
```

## Configuration Files

- `next.config.fast.mjs` - Optimized config for development
- `next.config.dev.mjs` - Alternative optimized config
- `next.config.mjs` - Original production config
- `scripts/dev-fast.sh` - Shell script for fast dev mode

## Switching Between Modes

### Fast Development Mode

```bash
# Copy fast config and run
cp next.config.fast.mjs next.config.mjs
npm run dev
```

### Production Mode (with translations)

```bash
# Restore original config
cp next.config.original.mjs next.config.mjs
npm run dev
```

## Environment Variables for Optimization

Add these to your `.env` file for additional optimizations:

```env
# Disable telemetry
NEXT_TELEMETRY_DISABLED=1

# Disable GT translation warnings
NEXT_PUBLIC_DISABLE_GT=true

# Increase Node memory
NODE_OPTIONS="--max-old-space-size=4096"
```

## Tips for Even Faster Development

1. **Use Turbo Mode**: If available, `--turbo` flag provides faster rebuilds
2. **Limit File Watching**: Work on one section at a time
3. **Close Other Apps**: Free up system resources
4. **Use SSD**: Ensure your project is on an SSD
5. **Clear Cache Periodically**: `rm -rf .next` if builds get slow

## Working with Specific Content

When editing files in `docs/src/content/en/`:

1. The optimized config only processes English content
2. Changes are reflected immediately without translation processing
3. Hot reload is much faster for MDX files

## Reverting to Original Configuration

If you need the full feature set (translations, all locales):

```bash
# Restore original configuration
cp next.config.original.mjs next.config.mjs

# Run with full features
npm run dev:original
```

## Troubleshooting

### If builds are still slow:

1. Clear Next.js cache: `rm -rf .next`
2. Clear node_modules: `rm -rf node_modules && npm install`
3. Increase memory: `NODE_OPTIONS="--max-old-space-size=8192" npm run dev:fast`

### If hot reload isn't working:

1. Check that you're editing files in `src/content/en/`
2. Restart the dev server
3. Clear browser cache

### If you see translation warnings:

- This is expected in fast mode
- Set `NEXT_PUBLIC_DISABLE_GT=true` in `.env` to suppress
