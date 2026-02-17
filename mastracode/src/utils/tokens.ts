/**
 * Token estimation utilities.
 *
 * Uses js-tiktoken with the o200k_base encoding (Claude/GPT-4o tokenizer)
 * for accurate token counts — critical for OM threshold logic.
 */

import { Tiktoken } from "js-tiktoken/lite"
import o200k_base from "js-tiktoken/ranks/o200k_base"

const enc = new Tiktoken(o200k_base)

function sanitizeInput(text: string | object): string {
    if (!text) return ""
    return (typeof text === "string" ? text : JSON.stringify(text))
        .replaceAll("<|endoftext|>", "")
        .replaceAll("<|endofprompt|>", "")
}

/**
 * Count the number of tokens in a string or JSON-serializable object.
 */
export function tokenEstimate(text: string | object): number {
    return enc.encode(sanitizeInput(text), "all").length
}

/**
 * Truncate a string to approximately `desiredTokenCount` tokens.
 * By default truncates from the start (keeps the end).
 */
export function truncateStringForTokenEstimate(
    text: string,
    desiredTokenCount: number,
    fromEnd = true,
): string {
    const tokens = enc.encode(sanitizeInput(text))

    if (tokens.length <= desiredTokenCount) return text

    return `[Truncated ${tokens.length - desiredTokenCount} tokens]\n${enc.decode(tokens.slice(fromEnd ? -desiredTokenCount : 0, fromEnd ? undefined : desiredTokenCount))}`
}
