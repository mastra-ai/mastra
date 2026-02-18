/**
 * Maps file extensions to LSP language identifiers
 */
export const LANGUAGE_EXTENSIONS: Record<string, string> = {
	// TypeScript/JavaScript
	".ts": "typescript",
	".tsx": "typescriptreact",
	".js": "javascript",
	".jsx": "javascriptreact",
	".mjs": "javascript",
	".cjs": "javascript",

	// Python
	".py": "python",
	".pyi": "python",

	// Go
	".go": "go",

	// Rust
	".rs": "rust",

	// C/C++
	".c": "c",
	".cpp": "cpp",
	".cc": "cpp",
	".cxx": "cpp",
	".h": "c",
	".hpp": "cpp",

	// Java
	".java": "java",

	// JSON
	".json": "json",
	".jsonc": "jsonc",

	// YAML
	".yaml": "yaml",
	".yml": "yaml",

	// Markdown
	".md": "markdown",

	// HTML/CSS
	".html": "html",
	".css": "css",
	".scss": "scss",
	".sass": "sass",
	".less": "less",
}

/**
 * Get LSP language ID for a file path
 */
export function getLanguageId(filePath: string): string | undefined {
	const ext = filePath.substring(filePath.lastIndexOf("."))
	return LANGUAGE_EXTENSIONS[ext]
}
