/**
 * Thread lock — ensures only one process writes to a thread at a time.
 *
 * Uses filesystem lock files: <appDataDir>/locks/<threadId>.lock
 * Each lock file contains the PID of the owning process.
 * Stale locks (from crashed processes) are detected and reclaimed.
 */
import * as fs from "fs"
import * as path from "path"
import { getAppDataDir } from "./project.js"

export class ThreadLockError extends Error {
	constructor(
		public readonly threadId: string,
		public readonly ownerPid: number,
	) {
		super(`Thread ${threadId} is locked by another process (PID ${ownerPid})`)
		this.name = "ThreadLockError"
	}
}

function getLocksDir(): string {
	const dir = path.join(getAppDataDir(), "locks")
	if (!fs.existsSync(dir)) {
		fs.mkdirSync(dir, { recursive: true })
	}
	return dir
}

function getLockPath(threadId: string): string {
	// Sanitize thread ID for filesystem safety
	const safeId = threadId.replace(/[^a-zA-Z0-9_-]/g, "_")
	return path.join(getLocksDir(), `${safeId}.lock`)
}

function isProcessAlive(pid: number): boolean {
	try {
		process.kill(pid, 0)
		return true
	} catch {
		return false
	}
}

/**
 * Attempt to acquire a lock for the given thread.
 * Throws ThreadLockError if another live process holds the lock.
 * Reclaims stale locks from dead processes.
 */
export function acquireThreadLock(threadId: string): void {
	const lockPath = getLockPath(threadId)
	const myPid = process.pid

	// Check for existing lock
	if (fs.existsSync(lockPath)) {
		try {
			const content = fs.readFileSync(lockPath, "utf-8").trim()
			const ownerPid = parseInt(content, 10)

			if (!isNaN(ownerPid) && ownerPid !== myPid && isProcessAlive(ownerPid)) {
				throw new ThreadLockError(threadId, ownerPid)
			}
			// Stale lock (dead process) or our own lock — reclaim it
		} catch (error) {
			if (error instanceof ThreadLockError) throw error
			// File read error — try to overwrite
		}
	}

	// Write our PID to the lock file
	fs.writeFileSync(lockPath, String(myPid), { mode: 0o644 })
}

/**
 * Release the lock for the given thread (only if we own it).
 */
export function releaseThreadLock(threadId: string): void {
	const lockPath = getLockPath(threadId)
	const myPid = process.pid

	try {
		if (!fs.existsSync(lockPath)) return

		const content = fs.readFileSync(lockPath, "utf-8").trim()
		const ownerPid = parseInt(content, 10)

		// Only remove if we own it
		if (ownerPid === myPid) {
			fs.unlinkSync(lockPath)
		}
	} catch {
		// Best-effort cleanup — ignore errors
	}
}

/**
 * Check if a thread is locked by another process.
 * Returns the PID of the owner if locked, null otherwise.
 */
export function getThreadLockOwner(threadId: string): number | null {
	const lockPath = getLockPath(threadId)

	try {
		if (!fs.existsSync(lockPath)) return null

		const content = fs.readFileSync(lockPath, "utf-8").trim()
		const ownerPid = parseInt(content, 10)

		if (isNaN(ownerPid)) return null
		if (ownerPid === process.pid) return null // Our own lock
		if (!isProcessAlive(ownerPid)) {
			// Stale lock — clean it up
			try {
				fs.unlinkSync(lockPath)
			} catch {}
			return null
		}

		return ownerPid
	} catch {
		return null
	}
}

/**
 * Release all thread locks owned by this process.
 * Call this on process exit.
 */
export function releaseAllThreadLocks(): void {
	try {
		const locksDir = getLocksDir()
		const files = fs.readdirSync(locksDir)
		const myPid = String(process.pid)

		for (const file of files) {
			if (!file.endsWith(".lock")) continue
			const lockPath = path.join(locksDir, file)
			try {
				const content = fs.readFileSync(lockPath, "utf-8").trim()
				if (content === myPid) {
					fs.unlinkSync(lockPath)
				}
			} catch {
				// Best-effort
			}
		}
	} catch {
		// Best-effort
	}
}
