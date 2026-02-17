import type {
    Harness,
    HarnessEvent,
    HarnessEventListener,
    HarnessMessage,
    TokenUsage,
} from "@mastra/core/harness"
import { execSync } from "node:child_process"
import { Container, ProcessTerminal, Spacer, Text, TUI, visibleWidth } from "@mariozechner/pi-tui"
import chalk from "chalk"
import { AskQuestionInlineComponent } from "./components/inline/ask-question-inline"
import { PlanApprovalInlineComponent } from "./components/inline/plan-approval-inline"
import { AssistantMessageComponent } from "./components/message/assistant"
import { UserMessageComponent } from "./components/message/user"
import { OMMarkerComponent } from "./components/om/marker"
import {
    defaultOMProgressState,
    formatObservationStatus,
    formatReflectionStatus,
    OMProgressComponent,
    type OMProgressState,
} from "./components/om/progress"
import { ErrorDisplayComponent } from "./components/output/error-display"
import { ShellOutputComponent } from "./components/output/shell-output"
import { SlashCommandComponent } from "./components/output/slash-command"
import { SystemReminderComponent } from "./components/output/system-reminder"
import { TodoProgressComponent } from "./components/progress/todo-progress"
import { CustomEditor } from "./components/shared/custom-editor"
import {
    applyGradientSweep,
    GradientAnimator,
} from "./components/shared/obi-loader"
import { ModelSelectorComponent, type ModelItem } from "./components/shared/model-selector"
import { ThreadSelectorComponent } from "./components/shared/thread-selector"
import {
    ToolExecutionComponentEnhanced,
    type ToolResult,
} from "./components/tool/execution-enhanced"
import { ToolApprovalDialogComponent } from "./components/tool/approval-dialog"
import { bold, fg, getEditorTheme, mastra, tintHex } from "./theme"

export interface MastraTUIOptions {
    harness: Harness<any>
    initialMessage?: string
    verbose?: boolean
    appName?: string
    version?: string
    inlineQuestions?: boolean
}

export class MastraTUI {
    private harness: Harness<any>
    private options: MastraTUIOptions

    private ui: TUI
    private terminal: ProcessTerminal
    private chatContainer: Container
    private editorContainer: Container
    private footer: Container
    private editor: CustomEditor
    private statusLine?: Text
    private memoryStatusLine?: Text

    private inlineQuestions: boolean
    private isInitialized = false
    private isAgentActive = false
    private gradientAnimator?: GradientAnimator
    private pendingNewThread = false
    private hideThinkingBlock = true
    private toolOutputExpanded = false
    private lastCtrlCTime = 0

    private tokenUsage: TokenUsage = {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
    }
    private projectRootPath = process.cwd()
    private projectDisplayPath = process.cwd()
    private omProgress: OMProgressState = defaultOMProgressState()
    private omProgressComponent?: OMProgressComponent
    private todoProgress?: TodoProgressComponent
    private modelAuthStatus: { hasAuth: boolean; apiKeyEnvVar?: string } = {
        hasAuth: true,
    }

    private assistantComponents = new Map<string, AssistantMessageComponent>()
    private toolComponents = new Map<string, ToolExecutionComponentEnhanced>()
    private allToolComponents: ToolExecutionComponentEnhanced[] = []
    private allSlashCommandComponents: SlashCommandComponent[] = []
    private pendingToolApproval: { toolName: string } | null = null
    private streamingComponent?: AssistantMessageComponent
    private streamingMessage?: HarnessMessage
    private activeInlineQuestion?: AskQuestionInlineComponent
    private activeInlinePlanApproval?: PlanApprovalInlineComponent
    private unsubscribe?: () => void

    private shouldExit = false
    private readyResolver?: () => void
    private readyPromise: Promise<void>

    constructor(options: MastraTUIOptions) {
        this.options = options
        this.harness = options.harness
        this.inlineQuestions = options.inlineQuestions ?? true

        this.terminal = new ProcessTerminal()
        this.ui = new TUI(this.terminal)
        this.chatContainer = new Container()
        this.editorContainer = new Container()
        this.footer = new Container()
        this.editor = new CustomEditor(this.ui, getEditorTheme())

        this.readyPromise = new Promise<void>((resolve) => {
            this.readyResolver = resolve
        })

        this.setupKeyboardShortcuts()
    }

    async run(): Promise<void> {
        await this.init()
        if (this.options.initialMessage) {
            void this.fireMessage(this.options.initialMessage)
        }
        try {
            await this.readyPromise
        } finally {
            this.stop()
        }
    }

    stop(): void {
        this.unsubscribe?.()
        this.ui.stop()
        void this.harness.destroy()
    }

    private async init(): Promise<void> {
        if (this.isInitialized) return

        await this.harness.init()
        await this.promptForThreadSelection()
        this.tokenUsage = this.harness.usage.get()
        this.updateProjectInfo()

        this.buildLayout()
        this.setupEditorSubmitHandler()
        this.setupKeyHandlers()
        this.subscribeToHarness()

        this.ui.start()
        this.isInitialized = true

        this.updateTerminalTitle()
        await this.renderExistingMessages()
        this.ui.requestRender()
    }

    private buildLayout(): void {
        const appName = this.options.appName ?? "Mastra Code"
        const version = this.options.version ?? "0.1.0"
        const logo =
            fg("accent", "◆") +
            " " +
            bold(fg("accent", appName)) +
            fg("dim", ` v${version}`)
        const keyStyle = (k: string) => fg("accent", k)
        const sep = fg("dim", " · ")
        const instructions = [
            `  ${keyStyle("Ctrl+C")} ${fg("muted", "interrupt/clear")}${sep}${keyStyle("Ctrl+C×2")} ${fg("muted", "exit")}`,
            `  ${keyStyle("Enter")} ${fg("muted", "while working → steer")}${sep}${keyStyle("Ctrl+F")} ${fg("muted", "→ queue follow-up")}`,
            `  ${keyStyle("/")} ${fg("muted", "commands")}${sep}${keyStyle("!")} ${fg("muted", "shell")}${sep}${keyStyle("Ctrl+T")} ${fg("muted", "thinking")}${sep}${keyStyle("Ctrl+E")} ${fg("muted", "tools")}`,
        ].join("\n")
        this.ui.addChild(new Spacer(1))
        this.ui.addChild(
            new Text(
                `${logo}
${instructions}`,
                1,
                0,
            ),
        )
        this.ui.addChild(new Spacer(1))
        this.ui.addChild(this.chatContainer)

        this.todoProgress = new TodoProgressComponent()
        this.omProgressComponent = new OMProgressComponent(this.omProgress)
        this.ui.addChild(this.todoProgress)
        this.ui.addChild(this.editorContainer)
        this.editorContainer.addChild(this.editor)
        this.ui.addChild(this.footer)
        this.statusLine = new Text("", 0, 0)
        this.memoryStatusLine = new Text("", 0, 0)
        this.footer.addChild(this.statusLine)
        this.footer.addChild(this.memoryStatusLine)

        this.updateStatusLine()
        this.resetInput()
    }

    private resetInput(): void {
        this.editor.onSubmit = () => {
            void this.onSubmit(this.editor.getText())
        }
        this.ui.setFocus(this.editor)
    }

    private setupKeyboardShortcuts(): void {
        this.editor.onAction("clear", () => {
            const now = Date.now()
            if (now - this.lastCtrlCTime < 500) {
                this.shouldExit = true
                this.readyResolver?.()
                return
            }
            this.lastCtrlCTime = now
            if (this.harness.isRunning()) {
                this.harness.abort()
            } else {
                this.editor.setText("")
                this.ui.requestRender()
            }
        })

        this.editor.onAction("toggleThinking", () => {
            this.hideThinkingBlock = !this.hideThinkingBlock
            for (const component of this.assistantComponents.values()) {
                component.setHideThinkingBlock(this.hideThinkingBlock)
            }
            this.ui.requestRender()
        })

        this.editor.onAction("expandTools", () => {
            this.toolOutputExpanded = !this.toolOutputExpanded
            for (const tool of this.allToolComponents) {
                tool.setExpanded(this.toolOutputExpanded)
            }
            for (const slash of this.allSlashCommandComponents) {
                slash.setExpanded(this.toolOutputExpanded)
            }
            this.ui.requestRender()
        })
    }

    private setupEditorSubmitHandler(): void {
        // Kept for parity with upstream organization.
    }

    private setupKeyHandlers(): void {
        process.on("SIGINT", () => {
            if (this.harness.isRunning()) {
                this.harness.abort()
            } else {
                this.shouldExit = true
                this.readyResolver?.()
            }
        })
    }

    private subscribeToHarness(): void {
        const listener: HarnessEventListener = async (event) => {
            await this.handleEvent(event)
        }
        this.unsubscribe = this.harness.subscribe(listener)
    }

    private updateTerminalTitle(): void {
        const appName = this.options.appName ?? "Mastra Code"
        const cwd = this.projectRootPath.split("/").pop() || ""
        this.ui.terminal.setTitle(`${appName} - ${cwd}`)
    }

    private updateProjectInfo(): void {
        const state = this.harness.state.get() as { cwd?: string } | undefined
        this.projectRootPath = state?.cwd || process.cwd()

        const homedir = process.env.HOME || process.env.USERPROFILE || ""
        let displayPath = this.projectRootPath
        if (homedir && displayPath.startsWith(homedir)) {
            displayPath = `~${displayPath.slice(homedir.length)}`
        }

        const branch = this.getGitBranch(this.projectRootPath)
        this.projectDisplayPath = branch ? `${displayPath} (${branch})` : displayPath
    }

    private getGitBranch(rootPath: string): string | undefined {
        try {
            const branch = execSync("git rev-parse --abbrev-ref HEAD", {
                cwd: rootPath,
                encoding: "utf8",
                stdio: ["ignore", "pipe", "ignore"],
            }).trim()
            if (!branch || branch === "HEAD") return undefined
            return branch
        } catch {
            return undefined
        }
    }

    private async promptForThreadSelection(): Promise<void> {
        const threads = await this.harness.threads.list()
        if (threads.length === 0) {
            this.pendingNewThread = true
            return
        }
        const sorted = [...threads].sort(
            (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
        )
        await this.harness.threads.switch(sorted[0]!.id)
    }

    private async renderExistingMessages(): Promise<void> {
        this.chatContainer.clear()
        const messages = await this.harness.threads.messages()
        for (const message of messages) {
            if (message.role === "user") {
                const text = extractText(message)
                if (text) {
                    this.chatContainer.addChild(new UserMessageComponent(text))
                }
                continue
            }
            if (message.role === "assistant") {
                const assistant = new AssistantMessageComponent(
                    message,
                    this.hideThinkingBlock,
                )
                this.chatContainer.addChild(assistant)
                this.assistantComponents.set(message.id, assistant)
            }
        }
    }

    private updateStatusLine(): void {
        if (!this.statusLine || !this.memoryStatusLine) return
        const termWidth = (process.stdout.columns || 80) - 1
        const SEP = "  "
        const modeId = this.harness.modes.currentId()
        const modes = this.harness.modes.list()
        const currentMode = modes.find((m) => m.id === modeId) as
            | { color?: string; name?: string; modelId?: string }
            | undefined

        const omStatus = this.omProgress.status
        const isObserving = omStatus === "observing"
        const isReflecting = omStatus === "reflecting"
        const showOMMode = isObserving || isReflecting
        const OBSERVER_COLOR = mastra.orange
        const REFLECTOR_COLOR = mastra.pink
        const mainModeColor = currentMode?.color
        const modeColor = showOMMode
            ? isObserving
                ? OBSERVER_COLOR
                : REFLECTOR_COLOR
            : mainModeColor ?? "#7c3aed"
        const badgeName = showOMMode
            ? isObserving
                ? "observe"
                : "reflect"
            : (currentMode?.name ?? modeId ?? "unknown")
        const [mcr, mcg, mcb] = [
            parseInt(modeColor.slice(1, 3), 16),
            parseInt(modeColor.slice(3, 5), 16),
            parseInt(modeColor.slice(5, 7), 16),
        ]
        let badgeBrightness = 0.9
        if (this.gradientAnimator?.isRunning()) {
            const fade = this.gradientAnimator.getFadeProgress()
            if (fade < 1) {
                const offset = this.gradientAnimator.getOffset() % 1
                const animBrightness =
                    0.65 + 0.3 * (0.5 + 0.5 * Math.sin(offset * Math.PI * 2 + Math.PI))
                badgeBrightness = animBrightness + (0.9 - animBrightness) * fade
            }
        }
        const [mr, mg, mb] = [
            Math.floor(mcr * badgeBrightness),
            Math.floor(mcg * badgeBrightness),
            Math.floor(mcb * badgeBrightness),
        ]
        const modeBadge = chalk
            .bgRgb(mr, mg, mb)
            .hex(mastra.bg)
            .bold(` ${badgeName.toLowerCase()} `)
        const modeBadgeWidth = badgeName.length + 2

        const modelId = this.resolveModelId(showOMMode, isObserving, isReflecting)
        const shortModelId = modelId.includes("/") ? modelId.slice(modelId.indexOf("/") + 1) : modelId
        const tinyModelId = shortModelId
            .replace(/^claude-/, "")
            .replace(/^(\w+)-(\d+)-(\d{1,2})$/, "$1 $2.$3")

        const displayPath = this.projectDisplayPath
        const styleModelId = (id: string): string => {
            if (!this.modelAuthStatus.hasAuth) {
                const envVar = this.modelAuthStatus.apiKeyEnvVar
                return (
                    fg("dim", id) +
                    fg("error", " ✗") +
                    fg("muted", envVar ? ` (${envVar})` : " (no key)")
                )
            }
            const tintBg = tintHex(modeColor, 0.15)
            const padded = ` ${id} `
            if (this.gradientAnimator?.isRunning()) {
                const fade = this.gradientAnimator.getFadeProgress()
                if (fade < 1) {
                    const text = applyGradientSweep(
                        padded,
                        this.gradientAnimator.getOffset(),
                        modeColor,
                        fade,
                    )
                    return chalk.bgHex(tintBg)(text)
                }
            }
            const [r, g, b] = [
                parseInt(modeColor.slice(1, 3), 16),
                parseInt(modeColor.slice(3, 5), 16),
                parseInt(modeColor.slice(5, 7), 16),
            ]
            const dim = 0.8
            const styled = chalk
                .rgb(Math.floor(r * dim), Math.floor(g * dim), Math.floor(b * dim))
                .bold(padded)
            return chalk.bgHex(tintBg)(styled)
        }

        let shortModeBadge = ""
        let shortModeBadgeWidth = 0
        if (badgeName) {
            const shortName = badgeName.toLowerCase().charAt(0)
            shortModeBadge = chalk.bgRgb(mr, mg, mb).hex(mastra.bg).bold(` ${shortName} `)
            shortModeBadgeWidth = shortName.length + 2
        }

        const buildLine = (opts: {
            modelId: string
            memCompact?: "percentOnly" | "noBuffer" | "full"
            showDir: boolean
            badge?: "full" | "short"
        }): string | null => {
            const parts: Array<{ plain: string; styled: string }> = []
            parts.push({
                plain: ` ${opts.modelId} `,
                styled: styleModelId(opts.modelId),
            })

            const msgLabelStyler =
                this.omProgress.bufferingMessages && this.gradientAnimator?.isRunning()
                    ? (label: string) =>
                        applyGradientSweep(
                            label,
                            this.gradientAnimator!.getOffset(),
                            OBSERVER_COLOR,
                            this.gradientAnimator!.getFadeProgress(),
                        )
                    : undefined
            const obsLabelStyler =
                this.omProgress.bufferingObservations && this.gradientAnimator?.isRunning()
                    ? (label: string) =>
                        applyGradientSweep(
                            label,
                            this.gradientAnimator!.getOffset(),
                            REFLECTOR_COLOR,
                            this.gradientAnimator!.getFadeProgress(),
                        )
                    : undefined

            const obs = formatObservationStatus(this.omProgress, opts.memCompact, msgLabelStyler)
            const ref = formatReflectionStatus(this.omProgress, opts.memCompact, obsLabelStyler)
            if (obs) parts.push({ plain: obs, styled: obs })
            if (ref) parts.push({ plain: ref, styled: ref })

            const tokens = `tokens:${this.tokenUsage.totalTokens}`
            parts.push({ plain: tokens, styled: fg("muted", tokens) })

            if (opts.showDir) {
                parts.push({ plain: displayPath, styled: fg("dim", displayPath) })
            }

            const useBadge = opts.badge === "short" ? shortModeBadge : modeBadge
            const useBadgeWidth = opts.badge === "short" ? shortModeBadgeWidth : modeBadgeWidth
            const totalPlain =
                useBadgeWidth +
                parts.reduce(
                    (sum, p, i) => sum + visibleWidth(p.plain) + (i > 0 ? SEP.length : 0),
                    0,
                )
            if (totalPlain > termWidth) return null

            if (opts.showDir && parts.length >= 3) {
                const left = parts[0]!
                const center = parts.slice(1, -1)
                const right = parts[parts.length - 1]!
                const leftWidth = useBadgeWidth + visibleWidth(left.plain)
                const centerWidth = center.reduce(
                    (sum, p, i) => sum + visibleWidth(p.plain) + (i > 0 ? SEP.length : 0),
                    0,
                )
                const rightWidth = visibleWidth(right.plain)
                const freeSpace = termWidth - (leftWidth + centerWidth + rightWidth)
                const gapLeft = Math.floor(freeSpace / 2)
                const gapRight = freeSpace - gapLeft
                return (
                    useBadge +
                    left.styled +
                    " ".repeat(Math.max(gapLeft, 1)) +
                    center.map((p) => p.styled).join(SEP) +
                    " ".repeat(Math.max(gapRight, 1)) +
                    right.styled
                )
            }

            if (opts.showDir && parts.length === 2) {
                const mainStr = useBadge + parts[0]!.styled
                const right = parts[1]!
                const gap = termWidth - totalPlain
                return mainStr + " ".repeat(gap + SEP.length) + right.styled
            }

            return useBadge + parts.map((p) => p.styled).join(SEP)
        }

        const styledLine1 =
            buildLine({ modelId, memCompact: "full", showDir: true }) ??
            buildLine({ modelId, memCompact: "full", showDir: false }) ??
            buildLine({ modelId: tinyModelId, memCompact: "full", showDir: false }) ??
            buildLine({ modelId: tinyModelId, showDir: false }) ??
            buildLine({ modelId: tinyModelId, showDir: false, badge: "short" }) ??
            buildLine({
                modelId: tinyModelId,
                memCompact: "noBuffer",
                showDir: false,
                badge: "short",
            }) ??
            buildLine({
                modelId: tinyModelId,
                memCompact: "percentOnly",
                showDir: false,
            }) ??
            buildLine({
                modelId: tinyModelId,
                memCompact: "percentOnly",
                showDir: false,
                badge: "short",
            }) ??
            (shortModeBadge + styleModelId(tinyModelId))

        const line2 = ""
        this.footer.clear()
        this.statusLine = new Text(styledLine1, 0, 0)
        this.memoryStatusLine = new Text(line2, 0, 0)
        this.footer.addChild(this.statusLine)
        this.footer.addChild(this.memoryStatusLine)
        const [br, bg, bb] = [
            parseInt((mainModeColor ?? "#7c3aed").slice(1, 3), 16),
            parseInt((mainModeColor ?? "#7c3aed").slice(3, 5), 16),
            parseInt((mainModeColor ?? "#7c3aed").slice(5, 7), 16),
        ]
        this.editor.borderColor = (text: string) =>
            chalk.rgb(Math.floor(br * 0.35), Math.floor(bg * 0.35), Math.floor(bb * 0.35))(text)
    }

    private async onSubmit(raw: string): Promise<void> {
        const line = raw.trim()
        if (!line) return

        if (this.pendingToolApproval) {
            const normalized = line.toLowerCase()
            if (normalized === "y" || normalized === "yes") {
                this.harness.resolveToolApprovalDecision("approve")
                this.showInfo("approval granted")
            } else if (normalized === "n" || normalized === "no") {
                this.harness.resolveToolApprovalDecision("decline")
                this.showInfo("approval denied")
            } else {
                this.showInfo("please enter y or n")
                this.editor.setText("")
                this.ui.requestRender()
                return
            }
            this.pendingToolApproval = null
            this.editor.setText("")
            this.ui.requestRender()
            return
        }

        if (line === "/exit" || line === "/quit") {
            this.shouldExit = true
            this.readyResolver?.()
            return
        }

        if (line.startsWith("/")) {
            const handled = await this.handleSlashCommand(line)
            if (handled) {
                this.editor.setText("")
                this.ui.requestRender()
                return
            }
        }

        if (line.startsWith("!")) {
            this.handleShellPassthrough(line.slice(1).trim())
            this.editor.setText("")
            this.ui.requestRender()
            return
        }

        if (this.pendingNewThread) {
            await this.harness.threads.create()
            this.pendingNewThread = false
        }

        this.renderUserMessage(line)
        this.editor.setText("")
        this.ui.requestRender()

        if (this.harness.isRunning()) {
            this.harness.steer(line)
        } else {
            await this.fireMessage(line)
        }
    }

    private async handleSlashCommand(input: string): Promise<boolean> {
        if (input === "/help") {
            this.showInfo(
                "Commands: /help /exit /mode <id> /model list|<id> /thread new|list|switch <id>",
            )
            return true
        }
        if (input === "/thread list") {
            const threads = await this.harness.threads.list()
            this.chatContainer.addChild(
                new ThreadSelectorComponent(
                    threads,
                    this.harness.threads.current(),
                    async (threadId) => {
                        await this.harness.threads.switch(threadId)
                    },
                ),
            )
            return true
        }
        if (input.startsWith("/thread switch ")) {
            const id = input.slice("/thread switch ".length).trim()
            if (id) await this.harness.threads.switch(id)
            return true
        }
        if (input === "/thread new") {
            await this.harness.threads.create()
            return true
        }
        if (input === "/model list") {
            const modes = this.harness.modes.list()
            const items: ModelItem[] = modes.map((mode) => ({
                id: mode.id,
                label: mode.id,
            }))
            this.chatContainer.addChild(
                new ModelSelectorComponent(
                    items,
                    this.harness.modes.currentId(),
                    async (id) => {
                        await this.harness.modes.switch(id)
                    },
                ),
            )
            return true
        }
        if (input.startsWith("/model ")) {
            const id = input.slice("/model ".length).trim()
            if (id && id !== "list") await this.harness.modes.switch(id)
            return true
        }
        if (input.startsWith("/mode ")) {
            const id = input.slice("/mode ".length).trim()
            if (id) await this.harness.modes.switch(id)
            return true
        }

        const slash = new SlashCommandComponent(input, "Not implemented yet")
        this.chatContainer.addChild(slash)
        this.allSlashCommandComponents.push(slash)
        return true
    }

    private handleShellPassthrough(command: string): void {
        this.chatContainer.addChild(
            new ShellOutputComponent(
                command,
                "Shell passthrough is disabled in this harness prototype.",
            ),
        )
    }

    private async fireMessage(content: string): Promise<void> {
        try {
            await this.harness.send(content)
        } catch (error) {
            this.showError(error instanceof Error ? error.message : "Unknown error")
        }
    }

    private async handleEvent(event: HarnessEvent): Promise<void> {
        switch (event.type) {
            case "agent_start":
                this.isAgentActive = true
                if (!this.gradientAnimator) {
                    this.gradientAnimator = new GradientAnimator(() => {
                        this.updateStatusLine()
                        this.ui.requestRender()
                    })
                }
                this.gradientAnimator.start()
                this.updateStatusLine()
                this.ui.requestRender()
                break
            case "agent_end":
                this.isAgentActive = false
                this.gradientAnimator?.fadeOut()
                this.streamingComponent = undefined
                this.streamingMessage = undefined
                this.updateStatusLine()
                this.ui.requestRender()
                break
            case "mode_changed":
                this.showInfo(`mode changed: ${event.previousModeId} -> ${event.modeId}`)
                this.updateStatusLine()
                this.ui.requestRender()
                break
            case "thread_created":
                this.showInfo(`thread created: ${event.thread.title ?? event.thread.id}`)
                this.updateStatusLine()
                this.ui.requestRender()
                break
            case "thread_changed":
                this.showInfo(`thread switched: ${event.threadId}`)
                await this.renderExistingMessages()
                this.tokenUsage = this.harness.usage.get()
                this.updateStatusLine()
                this.ui.requestRender()
                break
            case "message_start":
                this.streamingMessage = event.message
                break
            case "message_update": {
                let component = this.assistantComponents.get(event.message.id)
                if (!component) {
                    component = new AssistantMessageComponent(
                        event.message,
                        this.hideThinkingBlock,
                    )
                    this.assistantComponents.set(event.message.id, component)
                    this.chatContainer.addChild(component)
                } else {
                    component.updateContent(event.message)
                }
                this.streamingComponent = component
                this.streamingMessage = event.message
                this.ui.requestRender()
                break
            }
            case "message_end":
                this.streamingComponent = undefined
                this.streamingMessage = undefined
                this.ui.requestRender()
                break
            case "tool_start": {
                const tool = new ToolExecutionComponentEnhanced(event.toolName, event.args)
                this.toolComponents.set(event.toolCallId, tool)
                this.allToolComponents.push(tool)
                this.chatContainer.addChild(tool)
                this.ui.requestRender()
                break
            }
            case "tool_update": {
                const tool = this.toolComponents.get(event.toolCallId)
                if (tool) {
                    tool.updateResult(
                        {
                            content: this.toText(event.partialResult),
                            isError: false,
                        },
                        true,
                    )
                    this.ui.requestRender()
                }
                break
            }
            case "tool_end": {
                const tool =
                    this.toolComponents.get(event.toolCallId) ??
                    new ToolExecutionComponentEnhanced("unknown_tool", {})
                const result: ToolResult = {
                    content: this.toText(event.result),
                    isError: event.isError,
                }
                tool.updateResult(result, false)
                this.toolComponents.delete(event.toolCallId)
                this.ui.requestRender()
                break
            }
            case "tool_approval_required":
                if (this.inlineQuestions) {
                    this.pendingToolApproval = { toolName: event.toolName }
                    this.chatContainer.addChild(
                        new ToolApprovalDialogComponent(event.toolName, (decision) => {
                            this.harness.resolveToolApprovalDecision(decision)
                        }),
                    )
                    this.ui.requestRender()
                }
                break
            case "shell_output":
                this.chatContainer.addChild(
                    new ShellOutputComponent(
                        `${event.stream} (${event.toolCallId})`,
                        event.output,
                    ),
                )
                this.ui.requestRender()
                break
            case "usage_update":
                this.tokenUsage = event.usage
                this.updateStatusLine()
                this.ui.requestRender()
                break
            case "om_status":
                this.omProgress = {
                    ...this.omProgress,
                    pendingTokens: event.windows.active.messages.tokens,
                    threshold: event.windows.active.messages.threshold,
                    thresholdPercent:
                        (event.windows.active.messages.tokens /
                            Math.max(1, event.windows.active.messages.threshold)) *
                        100,
                    observationTokens: event.windows.active.observations.tokens,
                    reflectionThreshold: event.windows.active.observations.threshold,
                    reflectionThresholdPercent:
                        (event.windows.active.observations.tokens /
                            Math.max(1, event.windows.active.observations.threshold)) *
                        100,
                    buffered: {
                        observations: {
                            status: event.windows.buffered.observations.status,
                            chunks: event.windows.buffered.observations.chunks,
                            messageTokens:
                                event.windows.buffered.observations.messageTokens,
                            projectedMessageRemoval:
                                event.windows.buffered.observations.projectedMessageRemoval,
                            observationTokens:
                                event.windows.buffered.observations.observationTokens,
                        },
                        reflection: {
                            status: event.windows.buffered.reflection.status,
                            inputObservationTokens:
                                event.windows.buffered.reflection.inputObservationTokens,
                            observationTokens:
                                event.windows.buffered.reflection.observationTokens,
                        },
                    },
                    generationCount: event.generationCount,
                    stepNumber: event.stepNumber,
                }
                this.omProgressComponent?.update(this.omProgress)
                this.updateStatusLine()
                this.ui.requestRender()
                break
            case "om_observation_start":
                this.omProgress = {
                    ...this.omProgress,
                    status: "observing",
                    observing: true,
                    reflecting: false,
                    cycleId: event.cycleId,
                    startTime: Date.now(),
                }
                this.omProgressComponent?.update(this.omProgress)
                this.chatContainer.addChild(
                    new OMMarkerComponent({
                        label: `observation start (${event.tokensToObserve} tokens)`,
                        active: true,
                    }),
                )
                this.updateStatusLine()
                this.ui.requestRender()
                break
            case "om_observation_end":
            case "om_observation_failed":
                this.omProgress = {
                    ...this.omProgress,
                    status: "idle",
                    observing: false,
                    cycleId: undefined,
                    startTime: undefined,
                }
                this.omProgressComponent?.update(this.omProgress)
                this.updateStatusLine()
                this.ui.requestRender()
                break
            case "om_reflection_start":
                this.omProgress = {
                    ...this.omProgress,
                    status: "reflecting",
                    observing: false,
                    reflecting: true,
                    cycleId: event.cycleId,
                    startTime: Date.now(),
                }
                this.omProgressComponent?.update(this.omProgress)
                this.updateStatusLine()
                this.ui.requestRender()
                break
            case "om_reflection_end":
            case "om_reflection_failed":
                this.omProgress = {
                    ...this.omProgress,
                    status: "idle",
                    reflecting: false,
                    cycleId: undefined,
                    startTime: undefined,
                }
                this.omProgressComponent?.update(this.omProgress)
                this.updateStatusLine()
                this.ui.requestRender()
                break
            case "om_buffering_start":
                this.omProgress = {
                    ...this.omProgress,
                    bufferingMessages:
                        event.operationType === "observation"
                            ? true
                            : this.omProgress.bufferingMessages,
                    bufferingObservations:
                        event.operationType === "reflection"
                            ? true
                            : this.omProgress.bufferingObservations,
                }
                this.omProgressComponent?.update(this.omProgress)
                this.updateStatusLine()
                this.ui.requestRender()
                break
            case "om_buffering_end":
            case "om_buffering_failed":
                this.omProgress = {
                    ...this.omProgress,
                    bufferingMessages:
                        event.operationType === "observation"
                            ? false
                            : this.omProgress.bufferingMessages,
                    bufferingObservations:
                        event.operationType === "reflection"
                            ? false
                            : this.omProgress.bufferingObservations,
                }
                this.omProgressComponent?.update(this.omProgress)
                this.updateStatusLine()
                this.ui.requestRender()
                break
            case "info":
                this.showInfo(event.message)
                this.ui.requestRender()
                break
            case "error":
                this.showError(event.error.message)
                this.ui.requestRender()
                break
            default:
                break
        }
    }

    private renderUserMessage(text: string): void {
        this.chatContainer.addChild(new UserMessageComponent(text))
    }

    private showInfo(message: string): void {
        this.chatContainer.addChild(new SystemReminderComponent(message))
    }

    private showError(message: string): void {
        this.chatContainer.addChild(new ErrorDisplayComponent(message))
        this.updateStatusLine()
    }

    private resolveModelId(
        showOMMode = false,
        isObserving = false,
        isReflecting = false,
    ): string {
        const state = this.harness.state.get() as {
            currentModelId?: string
            observerModelId?: string
            reflectorModelId?: string
        }
        if (showOMMode && isObserving && state?.observerModelId) return state.observerModelId
        if (showOMMode && isReflecting && state?.reflectorModelId) return state.reflectorModelId
        if (state?.currentModelId) return state.currentModelId
        const modes = this.harness.modes.list()
        const current = modes.find((m) => m.id === this.harness.modes.currentId()) as
            | { modelId?: string; observerModelId?: string; reflectorModelId?: string }
            | undefined
        if (showOMMode && isObserving && current?.observerModelId) return current.observerModelId
        if (showOMMode && isReflecting && current?.reflectorModelId) return current.reflectorModelId
        return current?.modelId || "anthropic/claude-sonnet-4-20250514"
    }

    private toText(value: unknown): string {
        if (typeof value === "string") return value
        if (value instanceof Error) return value.message
        try {
            return JSON.stringify(value)
        } catch {
            return String(value)
        }
    }
}

function extractText(message: HarnessMessage): string {
    return message.content
        .filter((c): c is { type: "text"; text: string } => c.type === "text")
        .map((c) => c.text)
        .join("\n")
        .trim()
}

