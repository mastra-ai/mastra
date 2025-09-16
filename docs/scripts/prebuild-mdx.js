#!/usr/bin/env node

/**
 * Pre-build MDX pages for faster development
 * This script compiles all MDX files ahead of time and creates a cache
 */

import { promises as fs } from "fs";
import path from "path";
import { glob } from "glob";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

async function prebuildMDX() {
  console.log("🚀 Pre-building MDX files for faster development...\n");

  try {
    // Step 1: Build the site in production mode to generate all pages
    console.log(
      "📦 Building production version to generate optimized bundles...",
    );
    console.log(
      "This will take a few minutes but will make development much faster.\n",
    );

    // Set environment to production temporarily
    process.env.NODE_ENV = "production";
    process.env.NEXT_TELEMETRY_DISABLED = "1";

    // Build with minimal config
    await execAsync("npm run build", {
      env: {
        ...process.env,
        NEXT_PUBLIC_DISABLE_GT: "true",
      },
      maxBuffer: 1024 * 1024 * 10, // 10MB buffer
    });

    console.log("✅ Production build complete!\n");

    // Step 2: Copy the built cache to a persistent location
    const cacheDir = path.join(process.cwd(), ".mdx-cache");
    const nextCacheDir = path.join(process.cwd(), ".next/cache");

    console.log("💾 Saving compiled MDX cache...");

    // Remove old cache if exists
    await fs.rm(cacheDir, { recursive: true, force: true });

    // Copy new cache
    await fs.cp(nextCacheDir, cacheDir, { recursive: true });

    console.log("✅ MDX cache saved to .mdx-cache\n");

    // Step 3: Create a cache manifest
    const mdxFiles = await glob("src/content/**/*.mdx");
    const manifest = {};

    for (const file of mdxFiles) {
      const stats = await fs.stat(file);
      manifest[file] = {
        mtime: stats.mtime.toISOString(),
        size: stats.size,
      };
    }

    await fs.writeFile(
      path.join(cacheDir, "manifest.json"),
      JSON.stringify(manifest, null, 2),
    );

    console.log(`✅ Cached ${mdxFiles.length} MDX files\n`);

    console.log(
      "🎉 Pre-build complete! Your development server will now start much faster.",
    );
    console.log("\nTo use the optimized development mode:");
    console.log("  npm run dev:cached\n");
  } catch (error) {
    console.error("❌ Pre-build failed:", error.message);
    process.exit(1);
  }
}

prebuildMDX();
