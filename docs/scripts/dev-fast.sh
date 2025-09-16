#!/bin/bash

# Fast development mode script for Mastra docs
# This script disables translations and optimizes for fast rebuilds

echo "🚀 Starting fast development mode..."
echo "   - Translations disabled"
echo "   - Japanese locale disabled"
echo "   - Optimized for English content only"
echo ""

# Set environment variables for development optimization
export NODE_ENV=development
export NEXT_PUBLIC_DISABLE_GT=true
export NEXT_TELEMETRY_DISABLED=1

# Use the optimized dev config
if [ -f "next.config.dev.mjs" ]; then
    # Backup original config if not already backed up
    if [ ! -f "next.config.original.mjs" ]; then
        cp next.config.mjs next.config.original.mjs
        echo "✅ Backed up original config to next.config.original.mjs"
    fi

    # Use dev config
    cp next.config.dev.mjs next.config.mjs
    echo "✅ Using optimized development config"
fi

# Run Next.js with optimizations
echo ""
echo "Starting Next.js development server..."
echo "----------------------------------------"

# Use turbo mode if available for even faster builds
if command -v turbo &> /dev/null; then
    npx next dev --turbo
else
    npx next dev
fi