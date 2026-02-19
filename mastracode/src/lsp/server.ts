import type { ChildProcess } from "node:child_process";
import { spawn } from "node:child_process"
import { existsSync } from "node:fs"
import { createRequire } from "node:module"
import path, { join } from "node:path"
import { pathToFileURL } from "node:url"
import { getLanguageId } from "./language"

/**
 * LSP Server definition and spawning logic
 */
export interface LSPServerInfo {
	id: string
	name: string
	languageIds: string[]
	root: (cwd: string) => string | null
	spawn: (
		root: string,
	) =>
		| ChildProcess
		| Promise<{ process: ChildProcess; initialization?: any } | undefined>
}

/**
 * Find the nearest project root directory
 */
export function findNearestRoot(cwd: string, markers: string[]): string | null {
	let current = cwd

	while (current !== "/") {
		for (const marker of markers) {
			if (existsSync(join(current, marker))) {
				return current
			}
		}

		const parent = join(current, "..")
		if (parent === current) break
		current = parent
	}

	return null
}

/**
 * Built-in LSP server definitions
 */
export const BUILTIN_SERVERS: Record<string, LSPServerInfo> = {
	typescript: {
		id: "typescript",
		name: "TypeScript Language Server",
		languageIds: [
			"typescript",
			"typescriptreact",
			"javascript",
			"javascriptreact",
		],
		root: (cwd: string) =>
			findNearestRoot(cwd, ["tsconfig.json", "package.json"]),
		spawn: async (root: string) => {
			// Try to resolve TypeScript from the project directory
			const requireFromRoot = createRequire(
				pathToFileURL(path.join(root, "package.json")),
			)
			let tsserver: string | undefined
			try {
				tsserver = requireFromRoot.resolve("typescript/lib/tsserver.js")
			} catch {
				tsserver = undefined
			}
			if (!tsserver) {
				return undefined
			}

			// Resolve typescript-language-server binary directly to avoid npx hangs
			// (npx can hang indefinitely in projects with pnpm links)
			const localBin = join(
				root,
				"node_modules",
				".bin",
				"typescript-language-server",
			)
			const cwdBin = join(
				process.cwd(),
				"node_modules",
				".bin",
				"typescript-language-server",
			)
			let tslsBinary: string
			if (existsSync(localBin)) {
				tslsBinary = localBin
			} else if (existsSync(cwdBin)) {
				tslsBinary = cwdBin
			} else {
				// Fall back to npx as last resort, but this may hang with pnpm links
				tslsBinary = "npx"
			}

			const args =
				tslsBinary === "npx"
					? ["typescript-language-server", "--stdio"]
					: ["--stdio"]

			const proc = spawn(tslsBinary, args, {
				cwd: root,
				stdio: ["pipe", "pipe", "pipe"],
			})

			return {
				process: proc,
				initialization: {
					tsserver: {
						path: tsserver,
						logVerbosity: "off",
					},
				},
			}
		},
	},

	eslint: {
		id: "eslint",
		name: "ESLint Language Server",
		languageIds: [
			"typescript",
			"typescriptreact",
			"javascript",
			"javascriptreact",
		],
		root: (cwd: string) =>
			findNearestRoot(cwd, [
				"package.json",
				".eslintrc.js",
				".eslintrc.json",
				".eslintrc.yml",
				".eslintrc.yaml",
			]),
		spawn: (root: string) => {
			const binaryPath = join(
				process.cwd(),
				"node_modules",
				".bin",
				"eslint-lsp",
			)
			return spawn(binaryPath, ["--stdio"], {
				cwd: root,
				stdio: ["pipe", "pipe", "pipe"],
			})
		},
	},

	python: {
		id: "python",
		name: "Python Language Server (Pyright)",
		languageIds: ["python"],
		root: (cwd: string) =>
			findNearestRoot(cwd, [
				"pyproject.toml",
				"setup.py",
				"requirements.txt",
				".git",
			]),
		spawn: (root: string) => {
			// Try node_modules first, then fall back to system PATH
			const localPath = join(
				process.cwd(),
				"node_modules",
				".bin",
				"pyright-langserver",
			)
			const binaryPath = existsSync(localPath)
				? localPath
				: "pyright-langserver"
			return spawn(binaryPath, ["--stdio"], {
				cwd: root,
				stdio: ["pipe", "pipe", "pipe"],
			})
		},
	},

	go: {
		id: "go",
		name: "Go Language Server (gopls)",
		languageIds: ["go"],
		root: (cwd: string) => findNearestRoot(cwd, ["go.mod", ".git"]),
		spawn: (root: string) => {
			return spawn("gopls", ["serve"], {
				cwd: root,
				stdio: ["pipe", "pipe", "pipe"],
			})
		},
	},

	rust: {
		id: "rust",
		name: "Rust Language Server (rust-analyzer)",
		languageIds: ["rust"],
		root: (cwd: string) => findNearestRoot(cwd, ["Cargo.toml", ".git"]),
		spawn: (root: string) => {
			return spawn("rust-analyzer", ["--stdio"], {
				cwd: root,
				stdio: ["pipe", "pipe", "pipe"],
			})
		},
	},
}

/**
 * Get all servers that can handle a file
 */
export function getServersForFile(
	filePath: string,
	cwd: string,
): LSPServerInfo[] {
	const languageId = getLanguageId(filePath)
	if (!languageId) return []

	return Object.values(BUILTIN_SERVERS).filter(
		(server) =>
			server.languageIds.includes(languageId) && server.root(cwd) !== null,
	)
}
