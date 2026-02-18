// Stub event bus for ACP mode - not used in TUI mode
import { EventEmitter } from "events"

class ACPEventBus extends EventEmitter {
	// No-op in TUI mode
}

export const acpEventBus = new ACPEventBus()
