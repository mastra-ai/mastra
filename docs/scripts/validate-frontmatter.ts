import path from 'path'
import fs from 'fs/promises'
import {
  type ParsedPackage,
  normalizeContent,
  extractFrontMatterBounds,
  parseFrontMatterYAML,
} from '../src/utils/frontmatter'

interface ValidationConfig {
  sourceDir: string
  skipPaths: string[]
  packagePattern: RegExp
  concurrency: number
}

const DEFAULT_CONFIG: ValidationConfig = {
  sourceDir: 'src/content/en',
  skipPaths: [
    'guides/',
    'docs/community/',
    'docs/getting-started/',
    'docs/mastra-cloud/',
    'docs/index.mdx',
    'models/',
    'docs/build-with-ai/skills.mdx',
  ],
  // Allow for @mastra/* packages + mastra + create-mastra + mastracode
  packagePattern: /^(@mastra\/[\w-]+|mastra|create-mastra|mastracode)$/,
  concurrency: 50,
}

interface ValidationError {
  type: 'missing_frontmatter' | 'missing_packages' | 'invalid_packages' | 'parse_error'
  message: string
  lineNumber?: number
}

interface FileValidationResult {
  file: string
  passed: boolean
  errors: ValidationError[]
}

interface ValidationSummary {
  total: number
  passed: number
  failed: number
  results: FileValidationResult[]
}

function shouldSkipPath(relativePath: string, skipPaths: string[]): boolean {
  return skipPaths.some(skipPath => relativePath.startsWith(skipPath) || relativePath === skipPath)
}

function validatePackagesField(
  packages: ParsedPackage[] | undefined,
  packagesFieldLine: number | undefined,
  config: ValidationConfig,
): ValidationError[] {
  if (packages === undefined) {
    return [
      {
        type: 'missing_packages',
        message: 'packages field is missing',
      },
    ]
  }

  if (packages.length === 0) {
    return [
      {
        type: 'invalid_packages',
        message: 'packages array must not be empty',
        lineNumber: packagesFieldLine,
      },
    ]
  }

  const errors: ValidationError[] = []

  for (const pkg of packages) {
    if (!config.packagePattern.test(pkg.value)) {
      errors.push({
        type: 'invalid_packages',
        message: `invalid package name: "${pkg.value}" (must match @mastra/*, mastra, or create-mastra)`,
        lineNumber: pkg.lineNumber,
      })
    }
  }

  return errors
}

function validateFileContent(content: string, relativePath: string, config: ValidationConfig): FileValidationResult {
  const normalized = normalizeContent(content)
  const bounds = extractFrontMatterBounds(normalized)

  if (!bounds) {
    return {
      file: relativePath,
      passed: false,
      errors: [
        {
          type: 'missing_frontmatter',
          message: 'no frontmatter found',
          lineNumber: 1,
        },
      ],
    }
  }

  const parsed = parseFrontMatterYAML(bounds.rawContent, bounds.contentStartLine)
  const errors = validatePackagesField(parsed.packages, parsed.packagesFieldLine, config)

  return {
    file: relativePath,
    passed: errors.length === 0,
    errors,
  }
}

async function collectMDXFiles(dirPath: string, sourceDir: string, config: ValidationConfig): Promise<string[]> {
  const files: string[] = []

  async function traverse(currentPath: string): Promise<void> {
    const entries = await fs.readdir(currentPath, { withFileTypes: true })
    const promises: Promise<void>[] = []

    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name)

      if (entry.isDirectory()) {
        if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
          promises.push(traverse(fullPath))
        }
      } else if (entry.name.endsWith('.mdx')) {
        const relativePath = path.relative(sourceDir, fullPath).replaceAll('\\', '/')

        if (!shouldSkipPath(relativePath, config.skipPaths)) {
          files.push(fullPath)
        }
      }
    }

    await Promise.all(promises)
  }

  await traverse(dirPath)
  return files
}

async function validateAllFiles(sourceDir: string, config: ValidationConfig): Promise<ValidationSummary> {
  const files = await collectMDXFiles(sourceDir, sourceDir, config)
  const results: FileValidationResult[] = []

  // Process files in batches
  for (let i = 0; i < files.length; i += config.concurrency) {
    const batch = files.slice(i, i + config.concurrency)

    const batchResults = await Promise.all(
      batch.map(async fullPath => {
        const relativePath = path.relative(sourceDir, fullPath).replaceAll('\\', '/')

        try {
          const content = await fs.readFile(fullPath, 'utf-8')
          return validateFileContent(content, relativePath, config)
        } catch (error) {
          return {
            file: relativePath,
            passed: false,
            errors: [
              {
                type: 'parse_error' as const,
                message: `failed to read file: ${error instanceof Error ? error.message : String(error)}`,
              },
            ],
          }
        }
      }),
    )

    results.push(...batchResults)
  }

  const failed = results.filter(r => !r.passed)

  return {
    total: results.length,
    passed: results.length - failed.length,
    failed: failed.length,
    results: failed,
  }
}

function formatError(result: FileValidationResult): string[] {
  return result.errors.map(error => {
    const location = error.lineNumber ? `${result.file}:${error.lineNumber}` : result.file
    return `  ${location}: ${error.message}`
  })
}

function printResults(summary: ValidationSummary): void {
  const missingFrontmatter = summary.results.filter(r => r.errors.some(e => e.type === 'missing_frontmatter'))
  const missingPackages = summary.results.filter(r => r.errors.some(e => e.type === 'missing_packages'))
  const invalidPackages = summary.results.filter(r => r.errors.some(e => e.type === 'invalid_packages'))
  const parseErrors = summary.results.filter(r => r.errors.some(e => e.type === 'parse_error'))

  if (missingFrontmatter.length > 0) {
    console.log('Missing frontmatter:')
    for (const result of missingFrontmatter) {
      console.log(formatError(result).join('\n'))
    }
    console.log()
  }

  if (missingPackages.length > 0) {
    console.log("Missing 'packages' field:")
    for (const result of missingPackages) {
      console.log(formatError(result).join('\n'))
    }
    console.log()
  }

  if (invalidPackages.length > 0) {
    console.log("Invalid 'packages' value:")
    for (const result of invalidPackages) {
      console.log(formatError(result).join('\n'))
    }
    console.log()
  }

  if (parseErrors.length > 0) {
    console.log('File read errors:')
    for (const result of parseErrors) {
      console.log(formatError(result).join('\n'))
    }
    console.log()
  }

  if (summary.failed === 0) {
    console.log(`All ${summary.total} files passed validation`)
  } else {
    console.log(`Passed: ${summary.passed}/${summary.total}`)
    console.log(`Failed: ${summary.failed}/${summary.total}`)
  }
}

async function main(): Promise<void> {
  console.log('Validating MDX frontmatter...\n')

  const config: ValidationConfig = {
    ...DEFAULT_CONFIG,
    sourceDir: path.join(process.cwd(), DEFAULT_CONFIG.sourceDir),
  }

  try {
    await fs.stat(config.sourceDir)
  } catch {
    console.error(`Error: Source directory not found: ${config.sourceDir}`)
    process.exit(1)
  }

  const summary = await validateAllFiles(config.sourceDir, config)

  printResults(summary)

  process.exit(summary.failed > 0 ? 1 : 0)
}

main().catch(error => {
  console.error('Unhandled error:', error instanceof Error ? error.message : error)
  process.exit(1)
})
