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
import { OMMarkerComponent, type OMMarkerData } from "./components/om/marker"
import { OMOutputComponent } from "./components/om/output"
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
import { SubagentExecutionComponent } from "./components/output/subagent-execution"
import { SystemReminderComponent } from "./components/output/system-reminder"
import { TodoProgressComponent, type TodoItem } from "./components/progress/todo-progress"
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
    private allOMOutputComponents: OMOutputComponent[] = []
    private pendingToolApproval: { toolName: string } | null = null
    private streamingComponent?: AssistantMessageComponent
    private streamingMessage?: HarnessMessage
    private activeOMMarker?: OMMarkerComponent
    private activeBufferingMarker?: OMMarkerComponent
    private activeInlineQuestion?: AskQuestionInlineComponent
    private activeInlinePlanApproval?: PlanApprovalInlineComponent
    private pendingQuestionId?: string
    private pendingPlanId?: string
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
        this.editor.onSubmit = (text: string) => {
            void this.onSubmit(text)
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
            for (const omOutput of this.allOMOutputComponents) {
                omOutput.setExpanded(this.toolOutputExpanded)
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
        const state = this.harness.state.get() as
            | { cwd?: string; projectPath?: string; gitBranch?: string }
            | undefined
        this.projectRootPath = state?.projectPath || state?.cwd || process.cwd()

        const homedir = process.env.HOME || process.env.USERPROFILE || ""
        let displayPath = this.projectRootPath
        if (homedir && displayPath.startsWith(homedir)) {
            displayPath = `~${displayPath.slice(homedir.length)}`
        }

        const branch = state?.gitBranch || this.getGitBranch(this.projectRootPath)
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

    private compactPathForStatus(path: string): string {
        const maxLen = 44
        if (path.length <= maxLen) return path
        const branchMatch = path.match(/\s\([^)]+\)$/)
        const branch = branchMatch?.[0] ?? ""
        const base = branch ? path.slice(0, -branch.length) : path
        const segments = base.split("/").filter(Boolean)
        const tail = segments.slice(-2).join("/")
        const compact = `~/${tail}`
        const candidate = `${compact}${branch}`
        if (candidate.length <= maxLen) return candidate
        const keep = Math.max(12, maxLen - branch.length - 1)
        return `${compact.slice(0, keep)}…${branch}`
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
        const compactDisplayPath = this.compactPathForStatus(displayPath)
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
            showMemory?: boolean
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

            if (opts.showMemory !== false) {
                const obs = formatObservationStatus(
                    this.omProgress,
                    opts.memCompact,
                    msgLabelStyler,
                )
                const ref = formatReflectionStatus(
                    this.omProgress,
                    opts.memCompact,
                    obsLabelStyler,
                )
                if (obs) parts.push({ plain: obs, styled: obs })
                if (ref) parts.push({ plain: ref, styled: ref })
            }

            if (opts.showDir) {
                const pathValue =
                    opts.modelId === modelId && opts.memCompact === "full"
                        ? displayPath
                        : compactDisplayPath
                parts.push({ plain: pathValue, styled: fg("dim", pathValue) })
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
            buildLine({ modelId: tinyModelId, memCompact: "full", showDir: true }) ??
            buildLine({ modelId: tinyModelId, showDir: true, badge: "short" }) ??
            buildLine({
                modelId: tinyModelId,
                memCompact: "noBuffer",
                showDir: true,
                badge: "short",
            }) ??
            buildLine({
                modelId: tinyModelId,
                memCompact: "percentOnly",
                showDir: true,
                badge: "short",
            }) ??
            buildLine({
                modelId: tinyModelId,
                showDir: true,
                showMemory: false,
                badge: "short",
            }) ??
            buildLine({
                modelId: shortModelId,
                showDir: true,
                showMemory: false,
                badge: "short",
            }) ??
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

        if (this.activeInlinePlanApproval) {
            const normalized = line.toLowerCase()
            if (normalized === "y" || normalized === "yes") {
                this.chatContainer.addChild(new SystemReminderComponent("plan approved"))
                this.activeInlinePlanApproval.onDecision(true)
                this.activeInlinePlanApproval = undefined
                this.pendingPlanId = undefined
            } else if (normalized === "n" || normalized === "no") {
                this.chatContainer.addChild(new SystemReminderComponent("plan rejected"))
                this.activeInlinePlanApproval.onDecision(false)
                this.activeInlinePlanApproval = undefined
                this.pendingPlanId = undefined
            } else {
                this.showInfo("please enter y or n")
                this.editor.setText("")
                this.ui.requestRender()
                return
            }
            this.editor.setText("")
            this.ui.requestRender()
            return
        }

        if (this.activeInlineQuestion) {
            this.activeInlineQuestion.onSubmit([line])
            this.activeInlineQuestion = undefined
            this.pendingQuestionId = undefined
            this.editor.setText("")
            this.ui.requestRender()
            return
        }

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
        const eventType = (event as { type: string }).type

        if (eventType === "model_changed") {
            this.updateStatusLine()
            this.ui.requestRender()
            return
        }
        if (eventType === "om_model_changed" || eventType === "subagent_model_changed") {
            this.updateStatusLine()
            this.ui.requestRender()
            return
        }
        if (eventType === "follow_up_queued") {
            const e = event as { count: number }
            this.showInfo(`Follow-up queued (${e.count} pending)`)
            this.ui.requestRender()
            return
        }
        if (eventType === "todo_updated") {
            const e = event as { todos?: TodoItem[] }
            this.todoProgress?.updateTodos(e.todos ?? [])
            this.ui.requestRender()
            return
        }
        if (eventType === "workspace_error") {
            const e = event as { error: Error }
            this.showError(`Workspace: ${e.error.message}`)
            this.ui.requestRender()
            return
        }
        if (eventType === "workspace_status_changed") {
            const e = event as { status: string; error?: Error }
            if (e.status === "error" && e.error) {
                this.showError(`Workspace: ${e.error.message}`)
                this.ui.requestRender()
            }
            return
        }
        if (eventType === "subagent_start") {
            const e = event as { agentType?: string; task?: string; modelId?: string }
            const label = [e.agentType, e.modelId].filter(Boolean).join(" · ") || "subagent"
            const status = e.task ? `start: ${e.task}` : "started"
            this.addOMComponentBeforeStreaming(new SubagentExecutionComponent(label, status))
            this.ui.requestRender()
            return
        }
        if (eventType === "subagent_tool_start") {
            const e = event as { subToolName?: string }
            this.addOMComponentBeforeStreaming(
                new SubagentExecutionComponent("subagent", `tool start: ${e.subToolName ?? "unknown"}`),
            )
            this.ui.requestRender()
            return
        }
        if (eventType === "subagent_tool_end") {
            const e = event as { subToolName?: string; isError?: boolean }
            this.addOMComponentBeforeStreaming(
                new SubagentExecutionComponent(
                    "subagent",
                    `${e.isError ? "tool failed" : "tool done"}: ${e.subToolName ?? "unknown"}`,
                ),
            )
            this.ui.requestRender()
            return
        }
        if (eventType === "subagent_end") {
            const e = event as { isError?: boolean; durationMs?: number }
            this.addOMComponentBeforeStreaming(
                new SubagentExecutionComponent(
                    "subagent",
                    `${e.isError ? "failed" : "done"}${typeof e.durationMs === "number" ? ` (${e.durationMs}ms)` : ""}`,
                ),
            )
            this.ui.requestRender()
            return
        }
        if (eventType === "subagent_text_delta" || eventType === "workspace_ready") {
            return
        }
        if (eventType === "ask_question") {
            const e = event as {
                questionId: string
                question: string
                options?: Array<{ label: string; description?: string }>
            }
            this.chatContainer.addChild(
                new SystemReminderComponent(`[ask] ${e.question}`),
            )
            if (e.options?.length) {
                this.chatContainer.addChild(
                    new SystemReminderComponent(
                        e.options.map((o, i) => `${i + 1}. ${o.label}`).join("  "),
                    ),
                )
            }
            this.activeInlineQuestion = new AskQuestionInlineComponent(
                {
                    id: e.questionId,
                    prompt: e.question,
                    options:
                        e.options?.map((o, i) => ({
                            id: String(i + 1),
                            label: o.label,
                        })) ?? [],
                    allowMultiple: false,
                },
                (answers) => {
                    this.harness.respondToQuestion(e.questionId, answers[0] ?? "")
                },
            )
            this.pendingQuestionId = e.questionId
            this.chatContainer.addChild(this.activeInlineQuestion)
            this.ui.requestRender()
            return
        }
        if (eventType === "sandbox_access_request") {
            const e = event as { questionId: string; path: string; reason: string }
            this.chatContainer.addChild(
                new SystemReminderComponent(`[sandbox] ${e.reason}`),
            )
            this.chatContainer.addChild(
                new SystemReminderComponent(`Path: ${e.path} (y/n)`),
            )
            this.activeInlineQuestion = new AskQuestionInlineComponent(
                {
                    id: e.questionId,
                    prompt: `Grant sandbox access to ${e.path}?`,
                    options: [
                        { id: "y", label: "Yes" },
                        { id: "n", label: "No" },
                    ],
                    allowMultiple: false,
                },
                (answers) => {
                    const a = (answers[0] ?? "").toLowerCase()
                    this.harness.respondToQuestion(
                        e.questionId,
                        a === "y" || a === "yes" ? "yes" : "no",
                    )
                },
            )
            this.pendingQuestionId = e.questionId
            this.chatContainer.addChild(this.activeInlineQuestion)
            this.ui.requestRender()
            return
        }
        if (eventType === "plan_approval_required") {
            const e = event as { planId: string; title: string; plan: string }
            this.chatContainer.addChild(
                new SystemReminderComponent(`[plan] ${e.title}`),
            )
            this.chatContainer.addChild(new SlashCommandComponent("/plan", e.plan))
            this.activeInlinePlanApproval = new PlanApprovalInlineComponent((approved) => {
                void this.harness.respondToPlanApproval(e.planId, {
                    action: approved ? "approved" : "rejected",
                })
            })
            this.pendingPlanId = e.planId
            this.chatContainer.addChild(this.activeInlinePlanApproval)
            this.ui.requestRender()
            return
        }
        if (eventType === "plan_approved") {
            this.chatContainer.addChild(new SystemReminderComponent("plan approved"))
            this.activeInlinePlanApproval = undefined
            this.pendingPlanId = undefined
            this.ui.requestRender()
            return
        }

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
                this.updateStatusLine()
                this.ui.requestRender()
                break
            case "thread_created":
                this.showInfo(`thread created: ${event.thread.title ?? event.thread.id}`)
                this.updateProjectInfo()
                this.updateStatusLine()
                this.ui.requestRender()
                break
            case "thread_changed":
                this.showInfo(`thread switched: ${event.threadId}`)
                await this.renderExistingMessages()
                this.updateProjectInfo()
                this.tokenUsage = this.harness.usage.get()
                {
                    const state = this.harness.state.get() as { todos?: TodoItem[] }
                    this.todoProgress?.updateTodos(state?.todos ?? [])
                }
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
                if (this.toolComponents.has(event.toolCallId)) {
                    break
                }
                const tool = new ToolExecutionComponentEnhanced(event.toolName, event.args)
                tool.setExpanded(this.toolOutputExpanded)
                this.toolComponents.set(event.toolCallId, tool)
                this.allToolComponents.push(tool)
                this.addOMComponentBeforeStreaming(tool)
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
                const tool = this.toolComponents.get(event.toolCallId)
                if (!tool) {
                    break
                }
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
                {
                    const tool = this.toolComponents.get(event.toolCallId)
                    if (tool?.appendStreamingOutput) {
                        tool.appendStreamingOutput(event.output)
                    } else {
                        this.addOMComponentBeforeStreaming(
                            new ShellOutputComponent(
                                `${event.stream} (${event.toolCallId})`,
                                event.output,
                            ),
                        )
                    }
                }
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
                this.removeMarker(this.activeOMMarker)
                this.activeOMMarker = new OMMarkerComponent({
                    type: "om_observation_start",
                    tokensToObserve: event.tokensToObserve,
                    operationType: event.operationType,
                })
                this.addOMComponentBeforeStreaming(this.activeOMMarker)
                this.updateStatusLine()
                this.ui.requestRender()
                break
            case "om_observation_end":
                this.omProgress = {
                    ...this.omProgress,
                    status: "idle",
                    observing: false,
                    cycleId: undefined,
                    startTime: undefined,
                }
                if (this.activeOMMarker) {
                    this.activeOMMarker.update({
                        type: "om_observation_end",
                        tokensObserved: event.tokensObserved,
                        observationTokens: event.observationTokens,
                        durationMs: event.durationMs,
                    })
                    this.activeOMMarker = undefined
                }
                if (event.observations) {
                    const output = new OMOutputComponent({
                        type: "observation",
                        observations: event.observations,
                        currentTask: event.currentTask,
                        suggestedResponse: event.suggestedResponse,
                        durationMs: event.durationMs,
                        tokensObserved: event.tokensObserved,
                        observationTokens: event.observationTokens,
                    })
                    output.setExpanded(this.toolOutputExpanded)
                    this.allOMOutputComponents.push(output)
                    this.addOMComponentBeforeStreaming(output)
                }
                this.omProgressComponent?.update(this.omProgress)
                this.updateStatusLine()
                this.ui.requestRender()
                break
            case "om_observation_failed":
                this.omProgress = {
                    ...this.omProgress,
                    status: "idle",
                    observing: false,
                    cycleId: undefined,
                    startTime: undefined,
                }
                if (this.activeOMMarker) {
                    this.activeOMMarker.update({
                        type: "om_observation_failed",
                        operationType: "observation",
                        error: event.error,
                    })
                    this.activeOMMarker = undefined
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
                this.removeMarker(this.activeOMMarker)
                this.activeOMMarker = new OMMarkerComponent({
                    type: "om_observation_start",
                    tokensToObserve: event.tokensToReflect,
                    operationType: "reflection",
                })
                this.addOMComponentBeforeStreaming(this.activeOMMarker)
                this.omProgressComponent?.update(this.omProgress)
                this.updateStatusLine()
                this.ui.requestRender()
                break
            case "om_reflection_end": {
                const preCompressionTokens = this.omProgress.observationTokens
                this.omProgress = {
                    ...this.omProgress,
                    status: "idle",
                    reflecting: false,
                    cycleId: undefined,
                    startTime: undefined,
                }
                if (this.activeOMMarker) {
                    this.activeOMMarker.update({
                        type: "om_observation_end",
                        tokensObserved: preCompressionTokens,
                        observationTokens: event.compressedTokens,
                        durationMs: event.durationMs,
                        operationType: "reflection",
                    })
                    this.activeOMMarker = undefined
                }
                if (event.observations) {
                    const output = new OMOutputComponent({
                        type: "reflection",
                        observations: event.observations,
                        durationMs: event.durationMs,
                        compressedTokens: event.compressedTokens,
                        tokensObserved: preCompressionTokens,
                    })
                    output.setExpanded(this.toolOutputExpanded)
                    this.allOMOutputComponents.push(output)
                    this.addOMComponentBeforeStreaming(output)
                }
                this.omProgressComponent?.update(this.omProgress)
                this.updateStatusLine()
                this.ui.requestRender()
                break
            }
            case "om_reflection_failed":
                this.omProgress = {
                    ...this.omProgress,
                    status: "idle",
                    reflecting: false,
                    cycleId: undefined,
                    startTime: undefined,
                }
                if (this.activeOMMarker) {
                    this.activeOMMarker.update({
                        type: "om_observation_failed",
                        operationType: "reflection",
                        error: event.error,
                    })
                    this.activeOMMarker = undefined
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
                this.removeMarker(this.activeBufferingMarker)
                this.activeBufferingMarker = new OMMarkerComponent({
                    type: "om_buffering_start",
                    operationType: event.operationType,
                    tokensToBuffer: event.tokensToBuffer,
                })
                this.addOMComponentBeforeStreaming(this.activeBufferingMarker)
                this.omProgressComponent?.update(this.omProgress)
                this.updateStatusLine()
                this.ui.requestRender()
                break
            case "om_buffering_end":
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
                if (this.activeBufferingMarker) {
                    this.activeBufferingMarker.update({
                        type: "om_buffering_end",
                        operationType: event.operationType,
                        tokensBuffered: event.tokensBuffered,
                        bufferedTokens: event.bufferedTokens,
                        observations: event.observations,
                    })
                    this.activeBufferingMarker = undefined
                }
                this.omProgressComponent?.update(this.omProgress)
                this.updateStatusLine()
                this.ui.requestRender()
                break
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
                if (this.activeBufferingMarker) {
                    this.activeBufferingMarker.update({
                        type: "om_buffering_failed",
                        operationType: event.operationType,
                        error: event.error,
                    })
                    this.activeBufferingMarker = undefined
                }
                this.omProgressComponent?.update(this.omProgress)
                this.updateStatusLine()
                this.ui.requestRender()
                break
            case "om_activation": {
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
                const markerData: OMMarkerData = {
                    type: "om_activation",
                    operationType: event.operationType,
                    tokensActivated: event.tokensActivated,
                    observationTokens: event.observationTokens,
                }
                const marker = new OMMarkerComponent(markerData)
                this.addOMComponentBeforeStreaming(marker)
                this.activeBufferingMarker = undefined
                this.omProgressComponent?.update(this.omProgress)
                this.updateStatusLine()
                this.ui.requestRender()
                break
            }
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

    private addOMComponentBeforeStreaming(component: Container): void {
        if (this.streamingComponent) {
            const idx = this.chatContainer.children.indexOf(this.streamingComponent)
            if (idx >= 0) {
                this.chatContainer.children.splice(idx, 0, component)
                this.chatContainer.invalidate()
                return
            }
        }
        this.chatContainer.addChild(component)
    }

    private removeMarker(marker?: OMMarkerComponent): void {
        if (!marker) return
        const idx = this.chatContainer.children.indexOf(marker)
        if (idx >= 0) {
            this.chatContainer.children.splice(idx, 1)
            this.chatContainer.invalidate()
        }
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

