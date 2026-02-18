// Stub IPC reporter for TUI mode - just logs to console or no-ops

export type IPCMessageType =
	| "shell-output"
	| "token-limits"
	| "agent-event"
	| "tool-call"
	| "tool-result"

export interface IPCMessage {
	type: IPCMessageType
	data: unknown
	timestamp: number
}

class IPCReporter {
	private enabled: boolean

	constructor() {
		// Disable IPC in TUI mode - we handle output differently
		this.enabled = false
	}

	send(type: IPCMessageType, data: unknown) {
		if (!this.enabled) {
			return
		}

		const message: IPCMessage = {
			type,
			data,
			timestamp: Date.now(),
		}

		if (process.send) {
			process.send(message)
		}
	}
}

// Export singleton instance
export const ipcReporter = new IPCReporter()
