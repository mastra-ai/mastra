/**
 * Shared frontmatter parsing utilities
 * Used by both validate-frontmatter.ts and docusaurus-plugin-llms-txt
 */

export interface ParsedPackage {
  value: string
  lineNumber: number
}

export interface ParsedFrontMatter {
  title?: string
  description?: string
  packages?: ParsedPackage[]
  packagesFieldLine?: number
}

export interface FrontMatterBounds {
  startLine: number
  endLine: number
  contentStartLine: number
  rawContent: string
}

/**
 * Normalize content by removing BOM and normalizing line endings
 */
export function normalizeContent(content: string): string {
  let normalized = content

  // Remove UTF-8 BOM if present
  if (normalized.charCodeAt(0) === 0xfeff) {
    normalized = normalized.slice(1)
  }

  // Normalize CRLF to LF
  normalized = normalized.replace(/\r\n/g, '\n')

  // Normalize standalone CR to LF
  normalized = normalized.replace(/\r/g, '\n')

  return normalized
}

/**
 * Extract frontmatter bounds from content
 */
export function extractFrontMatterBounds(content: string): FrontMatterBounds | null {
  const lines = content.split('\n')

  // First line must be exactly "---"
  if (lines[0]?.trim() !== '---') {
    return null
  }

  // Find closing "---"
  let endLineIndex = -1
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') {
      endLineIndex = i
      break
    }
  }

  if (endLineIndex === -1) {
    return null
  }

  const contentLines = lines.slice(1, endLineIndex)

  return {
    startLine: 1,
    endLine: endLineIndex + 1,
    contentStartLine: 2,
    rawContent: contentLines.join('\n'),
  }
}

/**
 * Parse YAML frontmatter content to extract title and packages
 */
export function parseFrontMatterYAML(content: string, startLine: number): ParsedFrontMatter {
  const lines = content.split('\n')
  const result: ParsedFrontMatter = {}

  let inPackagesArray = false
  let packages: ParsedPackage[] = []

  for (let i = 0; i < lines.length; i++) {
    const lineNumber = startLine + i
    const line = lines[i]

    // Check for array item (indented with "- ")
    const arrayItemMatch = line.match(/^(\s+)-\s+(.*)$/)
    if (arrayItemMatch && inPackagesArray) {
      const rawValue = arrayItemMatch[2]
      // Remove surrounding quotes if present
      const value = rawValue.trim().replace(/^["']|["']$/g, '')
      packages.push({ value, lineNumber })
      continue
    }

    // If we hit a non-array line while in packages array, we're done with packages
    if (inPackagesArray && line.trim() !== '' && !arrayItemMatch) {
      result.packages = packages
      inPackagesArray = false
    }

    // Check for "title:" key
    const titleMatch = line.match(/^title:\s*["']?(.+?)["']?\s*$/)
    if (titleMatch) {
      result.title = titleMatch[1]
    }

    // Check for "description:" key
    const descriptionMatch = line.match(/^description:\s*["']?(.+?)["']?\s*$/)
    if (descriptionMatch) {
      result.description = descriptionMatch[1]
    }

    // Check for "packages:" key
    const keyMatch = line.match(/^packages:\s*(.*)$/)
    if (keyMatch) {
      result.packagesFieldLine = lineNumber
      const value = keyMatch[1].trim()

      // Only handle multi-line array format (value should be empty)
      if (value === '') {
        inPackagesArray = true
        packages = []
      }
    }
  }

  // Handle trailing packages array
  if (inPackagesArray) {
    result.packages = packages
  }

  return result
}

/**
 * High-level function to extract frontmatter from file content
 */
export function extractFrontMatter(content: string): ParsedFrontMatter | null {
  const normalized = normalizeContent(content)
  const bounds = extractFrontMatterBounds(normalized)

  if (!bounds) {
    return null
  }

  return parseFrontMatterYAML(bounds.rawContent, bounds.contentStartLine)
}

/**
 * Get just the package names as a string array (convenience function)
 */
export function getPackageNames(frontmatter: ParsedFrontMatter | null): string[] {
  return frontmatter?.packages?.map(p => p.value) ?? []
}
