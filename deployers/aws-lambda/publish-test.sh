#!/bin/bash

# AWS Lambda Deployer Test Publishing Script
set -e

# Configuration
VERSION="0.0.1-test.$(date +%s)"  # Timestamp-based version

echo "🚀 Publishing @mastra/deployer-aws-lambda@${VERSION} to private registry"

# Backup original package.json
cp package.json package.json.backup

# Create test package.json with fixed dependencies
cat package.json.backup | \
  sed "s/\"version\": \".*\"/\"version\": \"${VERSION}\"/" | \
  sed "s/workspace:\^/^0.10.2-alpha.3/g" > package.json

# Build and publish
echo "📦 Building package..."
pnpm build

echo "🚀 Publishing package..."
npm publish --access public

echo "✅ Published @mastra/deployer-aws-lambda@${VERSION}"
echo ""
echo "📋 To test installation:"
echo "  npm install @mastra/deployer-aws-lambda"
echo ""
echo "🔄 To restore original package.json:"
echo "  mv package.json.backup package.json" 