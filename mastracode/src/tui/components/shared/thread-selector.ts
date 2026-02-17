import { Container, Spacer, Text } from "@mariozechner/pi-tui"
import type { HarnessThread } from "@mastra/core/harness"

export class ThreadSelectorComponent extends Container {
    constructor(
        threads: HarnessThread[],
        currentThreadId: string | null,
        onSelect: (threadId: string) => void,
    ) {
        super()
        this.addChild(new Spacer(1))
        this.addChild(new Text("Threads:", 0, 0))
        for (const thread of threads) {
            const marker = thread.id === currentThreadId ? "*" : " "
            this.addChild(
                new Text(` ${marker} ${thread.title ?? "Untitled"} (${thread.id})`, 0, 0),
            )
        }
        this.onSelect = onSelect
    }

    readonly onSelect: (threadId: string) => void
}

