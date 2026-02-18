// Stub for terminal manager - not used in TUI mode
// This is only needed for ACP (Agent Communication Protocol) mode

import { execa, type Subprocess } from "execa"
import { EventEmitter } from "events"
import { randomUUID } from "crypto"

export interface TerminalSession {
	terminalId: string
	process: Subprocess
	command: string
	args: string[]
	cwd: string
	outputBuffer: Buffer[]
	totalBytes: number
	exitCode: number | null
	exitSignal: string | null
	isRunning: boolean
	createdAt: Date
}

export interface TerminalOutput {
	terminalId: string
	output: string
	isComplete: boolean
	exitCode?: number
	exitSignal?: string
}

export class TerminalManager extends EventEmitter {
	private terminals: Map<string, TerminalSession> = new Map()
	private readonly maxBufferBytes = 10 * 1024 * 1024 // 10MB per terminal

	async createTerminal(
		command: string,
		args: string[] = [],
		cwd: string = process.cwd(),
		terminalId?: string,
	): Promise<string> {
		const id = terminalId || randomUUID()

		const childProcess = execa(command, args, {
			cwd,
			shell: true,
			all: true,
			buffer: false,
			reject: false,
		})

		const session: TerminalSession = {
			terminalId: id,
			process: childProcess,
			command,
			args,
			cwd,
			outputBuffer: [],
			totalBytes: 0,
			exitCode: null,
			exitSignal: null,
			isRunning: true,
			createdAt: new Date(),
		}

		this.terminals.set(id, session)

		if (childProcess.all) {
			childProcess.all.on("data", (chunk: Buffer) => {
				this.handleOutput(id, chunk)
			})
		}

		childProcess.on("exit", (code, signal) => {
			this.handleExit(id, code, signal)
		})

		childProcess.on("error", (error) => {
			this.handleError(id, error)
		})

		return id
	}

	getOutput(terminalId: string): TerminalOutput | null {
		const session = this.terminals.get(terminalId)
		if (!session) {
			return null
		}

		const output = Buffer.concat(session.outputBuffer).toString("utf-8")

		return {
			terminalId,
			output,
			isComplete: !session.isRunning,
			exitCode: session.exitCode ?? undefined,
			exitSignal: session.exitSignal ?? undefined,
		}
	}

	async waitForExit(
		terminalId: string,
		timeoutMs?: number,
	): Promise<TerminalOutput> {
		const session = this.terminals.get(terminalId)
		if (!session) {
			throw new Error(`Terminal not found: ${terminalId}`)
		}

		if (!session.isRunning) {
			return this.getOutput(terminalId)!
		}

		return new Promise((resolve, reject) => {
			let timeoutHandle: NodeJS.Timeout | undefined

			const onExit = () => {
				if (timeoutHandle) clearTimeout(timeoutHandle)
				const output = this.getOutput(terminalId)
				if (output) {
					resolve(output)
				} else {
					reject(new Error(`Terminal not found after exit: ${terminalId}`))
				}
			}

			this.once(`exit:${terminalId}`, onExit)

			if (timeoutMs) {
				timeoutHandle = setTimeout(() => {
					this.off(`exit:${terminalId}`, onExit)
					reject(new Error(`Terminal wait timeout after ${timeoutMs}ms`))
				}, timeoutMs)
			}
		})
	}

	async killTerminal(
		terminalId: string,
		signal: NodeJS.Signals = "SIGTERM",
	): Promise<boolean> {
		const session = this.terminals.get(terminalId)
		if (!session) {
			return false
		}

		if (!session.isRunning) {
			return true
		}

		try {
			session.process.kill(signal)
			return true
		} catch (error) {
			// Kill failed (non-fatal)
			return false
		}
	}

	releaseTerminal(terminalId: string): boolean {
		const session = this.terminals.get(terminalId)
		if (!session) {
			return false
		}

		if (session.isRunning) {
			this.killTerminal(terminalId, "SIGKILL")
		}

		this.terminals.delete(terminalId)
		return true
	}

	getActiveTerminals(): string[] {
		return Array.from(this.terminals.keys())
	}

	hasTerminal(terminalId: string): boolean {
		return this.terminals.has(terminalId)
	}

	async cleanup(): Promise<void> {
		const terminalIds = Array.from(this.terminals.keys())
		await Promise.all(
			terminalIds.map(async (id) => {
				await this.killTerminal(id, "SIGKILL")
				this.releaseTerminal(id)
			}),
		)
	}

	private handleOutput(terminalId: string, chunk: Buffer): void {
		const session = this.terminals.get(terminalId)
		if (!session) return

		if (session.totalBytes + chunk.length > this.maxBufferBytes) {
			// Buffer limit exceeded, truncating output
			return
		}

		session.outputBuffer.push(chunk)
		session.totalBytes += chunk.length

		this.emit(`output:${terminalId}`, chunk.toString("utf-8"))
	}

	private handleExit(
		terminalId: string,
		code: number | null,
		signal: NodeJS.Signals | null,
	): void {
		const session = this.terminals.get(terminalId)
		if (!session) return

		session.isRunning = false
		session.exitCode = code
		session.exitSignal = signal

		this.emit(`exit:${terminalId}`, { code, signal })
	}

	private handleError(terminalId: string, error: Error): void {
		const session = this.terminals.get(terminalId)
		if (!session) return

		session.isRunning = false

		this.emit(`error:${terminalId}`, error)
	}
}
