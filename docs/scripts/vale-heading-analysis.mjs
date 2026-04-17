#!/usr/bin/env node
/**
 * Analyzes HeadingSentenceCase violations by heading level.
 *
 * Usage: pnpm vale src/content/en/docs src/content/en/guides src/content/en/reference src/learn/content --output=line | node scripts/vale-heading-analysis.mjs [--level N]
 *
 * Reads Vale lint output from stdin, looks up the actual heading level
 * from each file, and groups/sorts by occurrence.
 */

import { readFileSync } from 'node:fs'

const args = process.argv.slice(2)
const levelFilter = args.includes('--level') ? parseInt(args[args.indexOf('--level') + 1]) : null
const hasLevelFilter = levelFilter !== null && !isNaN(levelFilter)

const input = readFileSync('/dev/stdin', 'utf8')
const lines = input
  .trim()
  .split('\n')
  .filter(l => l.includes('HeadingSentenceCase'))

const entries = []

for (const line of lines) {
  const m = line.match(/^(.+?):(\d+):\d+:.*?'(.+)'\.?$/)
  if (!m) continue

  const file = m[1]
  const lineNum = parseInt(m[2])
  const heading = m[3]

  // Read the actual line from the file to determine heading level
  let level = 0
  try {
    const content = readFileSync(file, 'utf8')
    const fileLine = content.split('\n')[lineNum - 1]
    if (fileLine) {
      const hMatch = fileLine.match(/^(#{1,6})\s/)
      if (hMatch) {
        level = hMatch[1].length
      }
    }
  } catch {
    continue
  }

  entries.push({ file, lineNum, heading, level })
}

// Filter by level if requested
const filtered = hasLevelFilter ? entries.filter(e => e.level === levelFilter) : entries

// Group by heading text and count occurrences
const byHeading = new Map()
for (const entry of filtered) {
  const key = entry.heading
  if (!byHeading.has(key)) {
    byHeading.set(key, { heading: key, level: entry.level, files: [] })
  }
  byHeading.get(key).files.push(`${entry.file}:${entry.lineNum}`)
}

// Sort by occurrence count (desc), then alphabetically
const sorted = [...byHeading.values()].sort((a, b) => {
  if (b.files.length !== a.files.length) return b.files.length - a.files.length
  return a.heading.localeCompare(b.heading)
})

// Output
if (hasLevelFilter) {
  console.log(`\n=== h${levelFilter} violations: ${filtered.length} total, ${sorted.length} unique ===\n`)
} else {
  // Show summary by level
  const byLevel = new Map()
  for (const e of entries) {
    byLevel.set(e.level, (byLevel.get(e.level) || 0) + 1)
  }
  console.log(`\n=== Summary by heading level ===`)
  for (const [level, count] of [...byLevel.entries()].sort((a, b) => a[0] - b[0])) {
    console.log(`  h${level}: ${count} violations`)
  }
  console.log(`  Total: ${entries.length}\n`)
}

for (const item of sorted) {
  const count = item.files.length
  if (count > 1) {
    console.log(`[${count}x] "${item.heading}"`)
    for (const f of item.files) {
      console.log(`      ${f}`)
    }
  } else {
    console.log(`[1x] "${item.heading}"  ← ${item.files[0]}`)
  }
}
