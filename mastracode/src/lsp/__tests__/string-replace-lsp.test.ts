import * as fs from "node:fs"
import * as path from "node:path"
import { describe, it, expect, afterAll, afterEach } from "vitest"
import { stringReplaceLspTool } from "../../tools/string-replace-lsp.js"
import { lspManager } from "../manager.js"

const projectRoot = path.resolve(import.meta.dirname, "../../../")

// Create temp files inside the project so the LSP can find tsconfig.json/package.json
const tmpDir = path.join(projectRoot, ".test-tmp")

function tmpFile(name: string): string {
	return path.join(tmpDir, name)
}

function writeTmpFile(name: string, content: string): string {
	const filePath = tmpFile(name)
	fs.mkdirSync(path.dirname(filePath), { recursive: true })
	fs.writeFileSync(filePath, content, "utf-8")
	return filePath
}

afterEach(() => {
	// Close all documents to avoid stale state between tests
	const files = fs.existsSync(tmpDir)
		? fs.readdirSync(tmpDir).filter((f) => f.endsWith(".ts"))
		: []
	for (const file of files) {
		lspManager.closeDocument(tmpFile(file))
	}
})

afterAll(async () => {
	// Clean up temp files
	if (fs.existsSync(tmpDir)) {
		fs.rmSync(tmpDir, { recursive: true })
	}
	await lspManager.shutdownAll()
})

describe("string_replace_lsp", () => {
	it("edits a file and returns LSP diagnostics for a type error", async () => {
		const filePath = writeTmpFile(
			"type-error.ts",
			`const message: string = "hello world"
export function greet(): string {
  return message
}
`,
		)

		// Introduce a type error: change the return type to number but keep returning a string
		const result = await stringReplaceLspTool.execute({
			path: filePath,
			old_str: `export function greet(): string {
  return message
}`,
			new_str: `export function greet(): number {
  return message
}`,
		})

		// The edit should succeed
		expect(result).toHaveProperty("content")
		const text = (result as any).content[0].text as string
		expect(text).toContain("has been edited")

		// Should contain LSP diagnostics with a type error
		expect(text).toContain("LSP Diagnostics")
		expect(text).toMatch(/[Ee]rror/)
		// The diagnostic should mention the type mismatch
		expect(text).toMatch(/string.*not assignable.*number|Type.*not assignable/)
	}, 30000)

	it("edits a file and returns no errors for a valid change", async () => {
		const filePath = writeTmpFile(
			"valid-change.ts",
			`export const greeting: string = "hello"
`,
		)

		// Make a valid change: rename the variable value
		const result = await stringReplaceLspTool.execute({
			path: filePath,
			old_str: `export const greeting: string = "hello"`,
			new_str: `export const greeting: string = "goodbye"`,
		})

		expect(result).toHaveProperty("content")
		const text = (result as any).content[0].text as string
		expect(text).toContain("has been edited")

		// Should have diagnostics section with no errors
		expect(text).toContain("LSP Diagnostics")
		expect(text).toContain("No errors or warnings")
	}, 30000)

	it("returns diagnostics for an undefined variable", async () => {
		const filePath = writeTmpFile(
			"undefined-var.ts",
			`export function add(a: number, b: number): number {
  return a + b
}
`,
		)

		// Introduce a reference to an undefined variable
		const result = await stringReplaceLspTool.execute({
			path: filePath,
			old_str: `  return a + b`,
			new_str: `  return a + b + c`,
		})

		expect(result).toHaveProperty("content")
		const text = (result as any).content[0].text as string
		expect(text).toContain("has been edited")

		// Should report the undefined variable
		expect(text).toContain("LSP Diagnostics")
		expect(text).toMatch(/[Ee]rror/)
		expect(text).toMatch(/cannot find name|Cannot find name/i)
	}, 30000)
})
