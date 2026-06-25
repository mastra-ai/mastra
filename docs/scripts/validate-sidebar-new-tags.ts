import { execFileSync } from 'child_process'
import fs from 'fs/promises'
import path from 'path'

/**
 * Validates that sidebar entries tagged as "new" were introduced recently.
 *
 * Usage:
 *   pnpm validate:sidebar-new-tags
 *   pnpm validate:sidebar-new-tags --days=14
 */

interface NewTagEntry {
	lineNo: number
	label: string
	id?: string
}

interface BlameInfo {
	sha: string
	authorTime: number
}

interface StaleNewTag extends NewTagEntry {
	file: string
	date: string
	ageDays: number
	sha: string
}

const SIDEBAR_FILES = [
	'src/content/docs/sidebars.js',
	'src/content/guides/sidebars.js',
	'src/content/reference/sidebars.js',
	'src/content/models/sidebars.js',
]

const DEFAULT_DAYS = 30
const DAY_MS = 86_400_000
const TAGS_START_RE = /tags:\s*\[/
const NEW_TAG_RE = /tags:\s*\[[^\]]*['"]new['"][^\]]*\]/
const NEW_TOKEN_RE = /['"]new['"]/
const LABEL_RE = /label:\s*['"]([^'"]+)['"]/
const ID_RE = /id:\s*['"]([^'"]+)['"]/

function parseDaysArg(): number {
	const daysArg = process.argv.find(arg => arg.startsWith('--days='))
	if (!daysArg) return DEFAULT_DAYS

	const days = Number(daysArg.slice('--days='.length))
	if (!Number.isInteger(days) || days <= 0) {
		throw new Error(`Invalid --days value: ${daysArg}. Expected a positive integer, for example --days=30.`)
	}

	return days
}

function findNewTagEntries(text: string): NewTagEntry[] {
	const lines = text.split('\n')
	const entries: NewTagEntry[] = []

	for (let index = 0; index < lines.length; index++) {
		const line = lines[index]!
		if (!TAGS_START_RE.test(line)) continue

		const tagLines: string[] = []
		let newTagLineNo = index + 1

		for (let tagIndex = index; tagIndex < lines.length; tagIndex++) {
			const tagLine = lines[tagIndex]!
			tagLines.push(tagLine)

			if (NEW_TOKEN_RE.test(tagLine)) {
				newTagLineNo = tagIndex + 1
			}

			if (tagLine.includes(']')) {
				break
			}
		}

		if (!NEW_TAG_RE.test(tagLines.join('\n'))) continue

		let label = 'Unknown sidebar item'
		let id: string | undefined

		for (let searchIndex = index - 1; searchIndex >= 0; searchIndex--) {
			const searchLine = lines[searchIndex]!

			if (!id) {
				const idMatch = ID_RE.exec(searchLine)
				if (idMatch) {
					id = idMatch[1]
				}
			}

			if (label === 'Unknown sidebar item') {
				const labelMatch = LABEL_RE.exec(searchLine)
				if (labelMatch) {
					label = labelMatch[1]!
				}
			}

			if (/^\s*\{\s*$/.test(searchLine)) {
				break
			}
		}

		entries.push({ lineNo: newTagLineNo, label, id })
	}

	return entries
}

function blameFile(relPath: string): Map<number, BlameInfo> {
	const output = execFileSync('git', ['blame', '-w', '--line-porcelain', '--', relPath], {
		cwd: process.cwd(),
		encoding: 'utf-8',
	})
	const blameByLine = new Map<number, BlameInfo>()

	let currentLineNo: number | undefined
	let currentSha: string | undefined
	let currentAuthorTime: number | undefined

	function flush(): void {
		if (currentLineNo !== undefined && currentSha && currentAuthorTime !== undefined) {
			blameByLine.set(currentLineNo, { sha: currentSha, authorTime: currentAuthorTime })
		}
	}

	for (const line of output.split('\n')) {
		const headerMatch = /^([0-9a-f]{40}) \d+ (\d+)/.exec(line)
		if (headerMatch) {
			flush()
			currentSha = headerMatch[1]
			currentLineNo = Number(headerMatch[2])
			currentAuthorTime = undefined
			continue
		}

		const authorTimeMatch = /^author-time (\d+)/.exec(line)
		if (authorTimeMatch) {
			currentAuthorTime = Number(authorTimeMatch[1])
		}
	}

	flush()

	return blameByLine
}

function formatDate(timestampMs: number): string {
	return new Date(timestampMs).toISOString().slice(0, 10)
}

async function main(): Promise<void> {
	const days = parseDaysArg()
	const thresholdMs = Date.now() - days * DAY_MS
	const stale: StaleNewTag[] = []
	let totalNewTags = 0

	for (const sidebarFile of SIDEBAR_FILES) {
		const fullPath = path.join(process.cwd(), sidebarFile)
		const text = await fs.readFile(fullPath, 'utf-8')
		const entries = findNewTagEntries(text)
		totalNewTags += entries.length

		if (entries.length === 0) continue

		const blameByLine = blameFile(sidebarFile)

		for (const entry of entries) {
			const blame = blameByLine.get(entry.lineNo)
			if (!blame) {
				throw new Error(`Could not find git blame information for ${sidebarFile}:${entry.lineNo}`)
			}

			const taggedAtMs = blame.authorTime * 1000
			if (taggedAtMs < thresholdMs) {
				stale.push({
					...entry,
					file: sidebarFile,
					date: formatDate(taggedAtMs),
					ageDays: Math.floor((Date.now() - taggedAtMs) / DAY_MS),
					sha: blame.sha,
				})
			}
		}
	}

	if (stale.length > 0) {
		console.log(`Found ${stale.length} sidebar "new" tag(s) older than ${days} days:\n`)

		for (const entry of stale) {
			const id = entry.id ? ` (${entry.id})` : ''
			console.log(
				`  ${entry.file}:${entry.lineNo}  "${entry.label}"${id} — tagged ${entry.date} (${entry.ageDays} days ago, ${entry.sha.slice(0, 10)})`,
			)
		}

		console.log('\nRemove the stale `new` tag(s) from these sidebar entries.')
		process.exit(1)
	}

	if (totalNewTags > 0) {
		console.log(`All ${totalNewTags} 'new' tags are within the ${days}-day window.`)
		return
	}

	console.log("No 'new' tags found in any sidebar.")
}

main().catch(error => {
	console.error('Failed to validate sidebar new tags:', error instanceof Error ? error.message : error)
	process.exit(1)
})
