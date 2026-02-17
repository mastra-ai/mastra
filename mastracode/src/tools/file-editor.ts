/**
 * FileEditor — fuzzy string replacement engine.
 *
 * This provides the "smart" string replacement that agents use for editing
 * files. It handles exact matches, whitespace-normalized matches, and
 * Levenshtein-based fuzzy matching — making agent edits robust even when
 * the LLM doesn't perfectly reproduce the target text.
 *
 * Ported from mastra-code with file I/O helpers inlined (the original
 * imported from ./utils.ts which was removed in favor of workspace tools).
 */

import { promises as fs } from "node:fs"
import { exec } from "node:child_process"
import { promisify } from "node:util"
import * as path from "node:path"
import { distance } from "fastest-levenshtein"
import { truncateStringForTokenEstimate } from "../utils/tokens"

const execAsync = promisify(exec)

// ---------------------------------------------------------------------------
// Inline file I/O helpers (previously in tools/utils.ts)
// ---------------------------------------------------------------------------

const SNIPPET_LINES = 4

async function readFile(filePath: string): Promise<string> {
    try {
        return await fs.readFile(filePath, "utf8")
    } catch (e) {
        const error = e instanceof Error ? e : new Error("Unknown error")
        throw new Error(`Failed to read ${filePath}: ${error.message}`)
    }
}

async function writeFile(filePath: string, content: string): Promise<void> {
    try {
        await fs.mkdir(path.dirname(filePath), { recursive: true })
        await fs.writeFile(filePath, content, "utf8")
    } catch (e) {
        const error = e instanceof Error ? e : new Error("Unknown error")
        throw new Error(`Failed to write to ${filePath}: ${error.message}`)
    }
}

/** Per-file write queue to serialize concurrent writes to the same path. */
const fileWriteQueues = new Map<string, Promise<unknown>>()

async function withFileLock<T>(
    filePath: string,
    fn: () => Promise<T>,
): Promise<T> {
    const normalizedPath = path.resolve(filePath)
    const currentQueue =
        fileWriteQueues.get(normalizedPath) ?? Promise.resolve()

    let resolve!: (value: T) => void
    let reject!: (error: unknown) => void
    const ourPromise = new Promise<T>((res, rej) => {
        resolve = res
        reject = rej
    })

    const queuePromise = currentQueue
        .catch(() => { })
        .then(async () => {
            try {
                resolve(await fn())
            } catch (error) {
                reject(error)
            }
        })

    fileWriteQueues.set(normalizedPath, queuePromise)
    queuePromise.finally(() => {
        if (fileWriteQueues.get(normalizedPath) === queuePromise) {
            fileWriteQueues.delete(normalizedPath)
        }
    })

    return ourPromise
}

function makeOutput(
    fileContent: string,
    fileDescriptor: string,
    initLine = 1,
    expandTabs = true,
): string {
    if (expandTabs) {
        fileContent = fileContent.replace(/\t/g, "    ")
    }
    const displayPath = path.isAbsolute(fileDescriptor)
        ? path.relative(process.cwd(), fileDescriptor)
        : fileDescriptor
    const lines = fileContent.split("\n")
    const numberedLines = lines
        .map((line, i) => `${(i + initLine).toString().padStart(6)}\t${line}`)
        .join("\n")
    return `Here's the result of running \`cat -n\` on ${displayPath}:\n${truncateStringForTokenEstimate(numberedLines, 500, false)}\n`
}

async function validatePath(
    command: string,
    filePath: string,
): Promise<void> {
    const absolutePath = path.isAbsolute(filePath)
        ? filePath
        : path.join(process.cwd(), filePath)
    if (!path.isAbsolute(filePath)) {
        filePath = absolutePath
    }
    try {
        const stats = await fs.stat(filePath)
        if (stats.isDirectory() && command !== "view") {
            throw new Error(
                `The path ${filePath} is a directory and only the \`view\` command can be used on directories`,
            )
        }
        if (command === "create" && stats.isFile()) {
            throw new Error(
                `File already exists at: ${filePath}. Cannot overwrite files using command \`create\``,
            )
        }
    } catch (e: any) {
        if (e?.code === "ENOENT" && command !== "create") {
            throw new Error(
                `The path ${filePath} does not exist. Please provide a valid path.`,
            )
        }
        if (command !== "create") {
            throw e
        }
    }
}

// ---------------------------------------------------------------------------
// String normalization helpers
// ---------------------------------------------------------------------------

function removeWhitespace(str: string): string {
    return str
        .replace(/\t/g, "")
        .replace(/ +/g, "")
        .replace(/^ +| +$/gm, "")
        .replace(/\r?\n/g, "\n")
        .replace(/\s/g, "")
}

function removeVaryingChars(str: string): string {
    return removeWhitespace(str)
        .replaceAll("\n", "")
        .replaceAll("'", "")
        .replaceAll('"', "")
        .replaceAll("`", "")
        .replaceAll("\\r", "")
}

// ---------------------------------------------------------------------------
// Argument interfaces
// ---------------------------------------------------------------------------

interface ViewArgs {
    path: string
    view_range?: [number, number]
}

interface CreateArgs {
    path: string
    file_text: string
}

interface StrReplaceArgs {
    path: string
    old_str: string
    new_str: string
    start_line?: number
}

interface InsertArgs {
    path: string
    insert_line: number
    new_str: string
}

// ---------------------------------------------------------------------------
// FileEditor class
// ---------------------------------------------------------------------------

export class FileEditor {
    async view(args: ViewArgs) {
        await validatePath("view", args.path)
        if (await this.isDirectory(args.path)) {
            if (args.view_range) {
                return "The `view_range` parameter is not allowed when `path` points to a directory."
            }
            const { stdout, stderr } = await execAsync(
                `find "${args.path}" -maxdepth 2 -not -path '*/\\.*'`,
            )
            if (stderr) return stderr
            return `Here's the files and directories up to 2 levels deep in ${args.path}, excluding hidden items:\n${stdout}\n`
        }
        const fileContent = await readFile(args.path)
        if (args.view_range) {
            const fileLines = fileContent.split("\n")
            const nLinesFile = fileLines.length
            const [start] = args.view_range
            let [, end] = args.view_range
            if (start < 1 || start > nLinesFile) {
                return `Invalid \`view_range\`: ${args.view_range}. Its first element \`${start}\` should be within the range of lines of the file: [1, ${nLinesFile}]`
            }
            if (end !== -1) {
                if (end > nLinesFile) {
                    end = nLinesFile
                }
                if (end < start) {
                    return `Invalid \`view_range\`: ${args.view_range}. Its second element \`${end}\` should be larger or equal than its first \`${start}\``
                }
            }
            const selectedLines =
                end === -1
                    ? fileLines.slice(start - 1)
                    : fileLines.slice(start - 1, end)
            return makeOutput(
                selectedLines.join("\n"),
                String(args.path),
                start,
            )
        }
        return makeOutput(fileContent, String(args.path))
    }

    async create(args: CreateArgs) {
        await validatePath("create", args.path)
        await writeFile(args.path, args.file_text)
        return `File created successfully at: ${args.path}`
    }

    async strReplace(args: StrReplaceArgs) {
        await validatePath("string_replace", args.path)
        if (args.old_str === args.new_str) {
            return `Received the same string for old_str and new_str`
        }

        return withFileLock(args.path, async () => {
            const fileContent = await readFile(args.path)

            // ---- Pass 1: exact match ----
            if (fileContent.includes(args.old_str)) {
                const processedNewStr = args.new_str || ""
                const newFileContent = fileContent
                    .split(args.old_str)
                    .join(processedNewStr)
                await writeFile(args.path, newFileContent)
                return `The file ${args.path} has been edited. `
            }

            // ---- Pass 2: whitespace-normalized exact match ----
            const normalizeWhitespace = (str: string) =>
                str.replace(/\s+/g, " ").trim()
            const normalizedOldStr = normalizeWhitespace(args.old_str)
            const normalizedContent = normalizeWhitespace(fileContent)

            if (normalizedContent.includes(normalizedOldStr)) {
                const lines = fileContent.split("\n")
                let bestMatch = { start: -1, end: -1, content: "" }
                const originalOldLineCount = args.old_str.split("\n").length
                const maxWindow = originalOldLineCount + 5

                for (let i = 0; i < lines.length; i++) {
                    for (
                        let j = i;
                        j <= Math.min(i + maxWindow, lines.length - 1);
                        j++
                    ) {
                        const candidate = lines.slice(i, j + 1).join("\n")
                        if (
                            normalizeWhitespace(candidate) === normalizedOldStr
                        ) {
                            bestMatch = {
                                start: i,
                                end: j,
                                content: candidate,
                            }
                            break
                        }
                    }
                    if (bestMatch.start !== -1) break
                }

                if (bestMatch.start !== -1) {
                    const beforeLines = lines.slice(0, bestMatch.start)
                    const afterLines = lines.slice(bestMatch.end + 1)
                    const newFileContent = [
                        ...beforeLines,
                        args.new_str || "",
                        ...afterLines,
                    ].join("\n")
                    await writeFile(args.path, newFileContent)

                    const fileLines = newFileContent.split("\n")
                    const startLine = Math.max(
                        0,
                        bestMatch.start - SNIPPET_LINES,
                    )
                    const endLine = Math.min(
                        fileLines.length,
                        bestMatch.start +
                        SNIPPET_LINES +
                        (args.new_str || "").split("\n").length,
                    )
                    const snippet = fileLines
                        .slice(startLine, endLine)
                        .join("\n")
                    let successMsg = `The file ${args.path} has been edited. `
                    successMsg += makeOutput(
                        snippet,
                        `a snippet of ${args.path}`,
                        startLine + 1,
                    )
                    successMsg +=
                        "Review the changes and make sure they are as expected. Edit the file again if necessary."
                    return successMsg
                }
            }

            // ---- Pass 3: fuzzy whitespace-agnostic matching ----
            const processedNewStr = args.new_str || ""
            const removeLeadingLineNumbers = (str: string): string => {
                return str
                    .split("\n")
                    .map((line) => line.replace(/^\s*\d+\s*/, ""))
                    .join("\n")
            }
            let oldStr = removeLeadingLineNumbers(args.old_str)
            let newStr = removeLeadingLineNumbers(processedNewStr)
            if (oldStr.startsWith("\\\n")) {
                oldStr = oldStr.substring("\\\n".length)
            }
            if (newStr.startsWith("\\\n")) {
                newStr = newStr.substring("\\\n".length)
            }

            const startLineArg =
                typeof args.start_line === "number"
                    ? Math.max(args.start_line - 5, 0)
                    : undefined

            const oldLinesSplit = oldStr.split("\n")
            const oldLinesOriginal = oldLinesSplit.filter((l, i) => {
                if (i === 0) return removeWhitespace(l) !== ""
                if (i + 1 !== oldLinesSplit.length) return true
                return removeWhitespace(l) !== ""
            })
            const oldLines = oldLinesOriginal.map(removeWhitespace)

            const split = (str: string): string[] => {
                return str
                    .split("\n")
                    .map((l: string) => l.replaceAll("\n", "\\n"))
            }
            const fileLines = split(fileContent)
            const normFileLines = fileLines.map(removeWhitespace)

            const bestMatch: {
                start: number
                avgDist: number
                type: string
                end?: number
            } = {
                start: -1,
                avgDist: Infinity,
                type: "replace-lines",
            }

            const isSingleLineReplacement = oldLines.length === 1
            const matchLineNumbers = normFileLines
                .map((l: string, index: number) =>
                    l === oldLines[0] ? index + 1 : null,
                )
                .filter(Boolean)

            if (
                isSingleLineReplacement &&
                matchLineNumbers.length > 1 &&
                !startLineArg
            ) {
                return `Single line search string "${oldLines[0]}" has too many matches. This will result in innacurate replacements. Found ${matchLineNumbers.length} matches. Pass start_line to choose one. Found on lines ${matchLineNumbers.join(", ")}`
            }

            let divergedMessage: string | undefined
            let divergenceAfterX = 0
            const fileNoSpace = removeVaryingChars(fileContent)
            const oldStringNoSpace = removeVaryingChars(oldStr)

            if (fileNoSpace.includes(oldStringNoSpace.substring(0, -1))) {
                let oldStringNoSpaceBuffer = oldStringNoSpace
                let startIndex: number | null = null
                let endIndex: number | null = null

                for (const [index, line] of split(fileContent).entries()) {
                    if (
                        startIndex === null &&
                        typeof startLineArg !== "undefined" &&
                        index + 1 > startLineArg + 50
                    ) {
                        continue
                    }
                    if (
                        typeof startLineArg !== "undefined" &&
                        index < startLineArg
                    ) {
                        continue
                    }
                    const lineNoSpace = removeVaryingChars(line)
                    if (lineNoSpace === "" && !startIndex) continue

                    const startsWith =
                        oldStringNoSpaceBuffer.startsWith(lineNoSpace)
                    const startsWithNoDanglingCommaTho =
                        !startsWith &&
                        lineNoSpace.endsWith(",") &&
                        oldStringNoSpaceBuffer
                            .substring(lineNoSpace.length - 1)
                            .startsWith(")") &&
                        oldStringNoSpaceBuffer.startsWith(
                            lineNoSpace.substring(0, lineNoSpace.length - 1),
                        )

                    if (startsWith || startsWithNoDanglingCommaTho) {
                        if (startIndex === null) {
                            startIndex = index
                        }
                        oldStringNoSpaceBuffer =
                            oldStringNoSpaceBuffer.substring(
                                startsWithNoDanglingCommaTho
                                    ? lineNoSpace.length - 1
                                    : lineNoSpace.length,
                            )
                        if (
                            oldStringNoSpaceBuffer.length === 0 &&
                            startIndex !== null
                        ) {
                            endIndex = index
                            break
                        }
                    } else if (startIndex !== null) {
                        startIndex = null
                        oldStringNoSpaceBuffer = oldStringNoSpace
                    }
                }

                if (startIndex !== null && endIndex !== null) {
                    bestMatch.start = startIndex
                    bestMatch.end = endIndex
                }
            }

            for (const [index, normLine] of normFileLines.entries()) {
                if (!normLine) continue
                if (bestMatch.end) break
                if (
                    typeof startLineArg !== "undefined" &&
                    index + 1 < startLineArg
                )
                    continue
                if (
                    typeof startLineArg !== "undefined" &&
                    index + 1 > startLineArg + 50
                )
                    continue
                if (
                    typeof startLineArg !== "undefined" &&
                    index + 1 > startLineArg + 5 &&
                    isSingleLineReplacement
                ) {
                    break
                }

                const firstDistance = distance(oldLines[0] || "", normLine || "")
                const firstPercentDiff =
                    (firstDistance / (normLine?.length || 1)) * 100

                if (
                    isSingleLineReplacement &&
                    (normLine === oldLines[0] ||
                        normLine.includes(oldLines[0]!))
                ) {
                    bestMatch.start = index
                    bestMatch.type = "replace-in-line"
                    continue
                }

                if (oldLines[0] === normLine || firstPercentDiff < 5) {
                    let isMatching = true
                    let matchingLineCount = 0

                    for (const [matchIndex, oldLine] of oldLines.entries()) {
                        const innerNormLine =
                            normFileLines[index + matchIndex] ?? ""
                        const innerDistance = distance(
                            oldLine,
                            innerNormLine,
                        )
                        const innerPercentDiff =
                            (innerDistance / (innerNormLine.length || 1)) * 100
                        const remainingLines =
                            oldLines.length - matchingLineCount
                        const percentLinesRemaining =
                            (remainingLines / oldLines.length) * 100
                        const isMatch =
                            oldLine === innerNormLine || innerPercentDiff < 5
                        const fewLinesAreLeft =
                            oldLines.length >= 30 && percentLinesRemaining < 1

                        if (isMatch || fewLinesAreLeft) {
                            matchingLineCount++
                        } else {
                            const message = `old_str matching diverged after ${matchingLineCount} matching lines.\nExpected line from old_str: \`${oldLinesOriginal[matchIndex]}\` (line ${matchIndex + 1} in old_str), found line: \`${fileLines[index + matchIndex]}\` (line ${index + 1 + matchIndex} in file). ${remainingLines - 1} lines remained to compare but they were not checked due to this line not matching.\n\nHere are the lines that did match up until the old_str diverged:\n\n${oldLinesOriginal.slice(0, matchIndex).join("\n")}\n\nHere are the remaining lines you would've had to provide for the old_str to match:\n\n${fileLines
                                .slice(
                                    index + matchIndex,
                                    index + matchIndex + remainingLines,
                                )
                                .join("\n")}`

                            if (matchingLineCount > divergenceAfterX) {
                                divergenceAfterX = matchingLineCount
                                divergedMessage = message
                            }
                            isMatching = false
                            break
                        }
                    }
                    if (isMatching) {
                        bestMatch.start = index
                        break
                    }
                }
            }

            if (
                bestMatch.start === -1 &&
                (isSingleLineReplacement || oldStr === "\n") &&
                newStr === "" &&
                typeof startLineArg === "number"
            ) {
                bestMatch.start = startLineArg
                bestMatch.type = "delete-line"
            }

            let newFileContent = ""

            if (bestMatch.start === -1) {
                return `No replacement was performed. No sufficiently close match for old_str found in ${args.path}.\n${divergedMessage ? divergedMessage : ""}Try adjusting your input or the file content.`
            }

            if (bestMatch.type === "replace-lines") {
                const newFileLines = [
                    ...fileLines.slice(0, bestMatch.start),
                    ...(newStr ? newStr.split("\n") : []),
                    ...fileLines.slice(
                        bestMatch.end
                            ? bestMatch.end + 1
                            : bestMatch.start + oldLines.length,
                    ),
                ]
                newFileContent = newFileLines.join("\n")
                await writeFile(args.path, newFileContent)
            } else if (bestMatch.type === "replace-in-line") {
                const [firstNew, ...restNew] = newStr
                    ? newStr.split("\n")
                    : []
                const newFileLines = [
                    ...fileLines.slice(0, bestMatch.start),
                    ...(restNew?.length
                        ? [firstNew, ...restNew]
                        : [
                            fileLines
                                .at(bestMatch.start)
                                ?.replace(
                                    oldLinesOriginal[0]!,
                                    firstNew || "",
                                ) ?? "",
                        ]),
                    ...fileLines.slice(bestMatch.start + 1),
                ]
                newFileContent = newFileLines.join("\n")
                await writeFile(args.path, newFileContent)
            } else if (bestMatch.type === "delete-line") {
                const newFileLines = [
                    ...fileLines.slice(0, bestMatch.start),
                    ...fileLines.slice(bestMatch.start + 1),
                ]
                newFileContent = newFileLines.join("\n")
                await writeFile(args.path, newFileContent)
            }

            const replacementLine = bestMatch.start + 1
            const startLine = Math.max(0, replacementLine - SNIPPET_LINES)
            const endLine =
                replacementLine + SNIPPET_LINES + newStr.split("\n").length
            const snippet = newFileContent
                .split("\n")
                .slice(startLine, endLine + 1)
                .join("\n")
            let successMsg = `The file ${args.path} has been edited. `
            successMsg += makeOutput(
                snippet,
                `a snippet of ${args.path}`,
                startLine + 1,
            )
            successMsg +=
                "Review the changes and make sure they are as expected. Edit the file again if necessary."
            return successMsg
        })
    }

    async insert(args: InsertArgs) {
        await validatePath("insert", args.path)
        const fileContent = await readFile(args.path)
        const newStr = args.new_str
        const fileLines = fileContent.split("\n")
        const nLinesFile = fileLines.length

        if (args.insert_line < 0 || args.insert_line > nLinesFile) {
            return `Invalid \`insert_line\` parameter: ${args.insert_line}. It should be within the range of lines of the file: [0, ${nLinesFile}]`
        }

        const newStrLines = newStr.split("\n")
        const newFileLines = [
            ...fileLines.slice(0, args.insert_line + 1),
            ...newStrLines,
            ...fileLines.slice(args.insert_line + 1),
        ]
        const snippetLines = [
            ...fileLines.slice(
                Math.max(0, args.insert_line - SNIPPET_LINES),
                args.insert_line + 1,
            ),
            ...newStrLines,
            ...fileLines.slice(
                args.insert_line + 1,
                args.insert_line + SNIPPET_LINES,
            ),
        ]
        const newFileContent = newFileLines.join("\n")
        const snippet = snippetLines.join("\n")
        await writeFile(args.path, newFileContent)

        let successMsg = `The file ${args.path} has been edited. `
        successMsg += makeOutput(
            snippet,
            "a snippet of the edited file",
            Math.max(1, args.insert_line - SNIPPET_LINES + 1),
        )
        successMsg +=
            "Review the changes and make sure they are as expected (correct indentation, no duplicate lines, etc). Edit the file again if necessary."
        return successMsg
    }

    private async isDirectory(filePath: string) {
        try {
            const stats = await fs.stat(filePath)
            return stats.isDirectory()
        } catch {
            return false
        }
    }
}

/** Singleton instance of FileEditor */
export const sharedFileEditor = new FileEditor()
