import type { Plugin } from 'rollup';

/**
 * Connection-string-shaped patterns that resolve to the build host and will
 * never work inside the deploy container.
 */
const LOCAL_HOST_PATTERNS: Array<{ pattern: RegExp; hint: string }> = [
  {
    pattern: /\bfile:\.{1,2}\/[^\s'"`]+\.(?:db|sqlite)\b/gi,
    hint: 'LibSQL/SQLite file path relative to the build host',
  },
  {
    pattern: /\b(?:postgres(?:ql)?|mysql|mongodb|redis|libsql):\/\/[^/\s'"`]*localhost\b/gi,
    hint: 'localhost in a connection string',
  },
  {
    pattern: /\b(?:postgres(?:ql)?|mysql|mongodb|redis|libsql):\/\/[^/\s'"`]*127\.0\.0\.1\b/g,
    hint: '127.0.0.1 in a connection string',
  },
];

export interface LocalStorageDetection {
  value: string;
  hint: string;
  module: string;
  /**
   * Name of the env var that guards this literal at runtime, when the
   * literal is the fallback arm of a `process.env.X || literal` (or `??`)
   * expression. The CLI preflight uses this to suppress or soften the
   * error when the guarding var is present in the deploy env.
   */
  guardedBy?: string;
}

/**
 * Unified preflight metadata emitted as `preflight-metadata.json`.
 * Superset of the legacy `preflight-local-paths.json` (which stays emitted
 * for one release so older CLIs keep working with newer deployers).
 */
export interface PreflightMetadata {
  version: 1;
  localPaths: LocalStorageDetection[];
  userEnvRefs: string[];
}

/**
 * Everything under `.mastra/.build/` is deployer-generated pre-bundled
 * dependency code (`@mastra__*.mjs` shims and their shared `chunk-*.mjs`
 * files), never user-authored. These preserve JSDoc examples from the
 * original library source (e.g. `LibSQLStore({ url: 'file:./data.db' })`)
 * which would otherwise trip the host-local detector, and their env var
 * reads are library refs that must not count as user references.
 */
const MASTRA_BUILD_DIR = /[\\/]\.mastra[\\/]\.build[\\/]/;

const PROCESS_ENV_DOT = /\bprocess\.env\.([A-Z_][A-Z0-9_]*)\b/g;
const PROCESS_ENV_BRACKET = /\bprocess\.env\[['"]([A-Z_][A-Z0-9_]*)['"]\]/g;

/** Names of the metadata assets emitted into the output dir. */
const LEGACY_LOCAL_PATHS_FILE = 'preflight-local-paths.json';
const PREFLIGHT_METADATA_FILE = 'preflight-metadata.json';

interface ModuleMatch {
  value: string;
  hint: string;
  guardedBy?: string;
}

function collectEnvRefs(code: string): Set<string> {
  const refs = new Set<string>();
  for (const m of code.matchAll(PROCESS_ENV_DOT)) refs.add(m[1]!);
  for (const m of code.matchAll(PROCESS_ENV_BRACKET)) refs.add(m[1]!);
  return refs;
}

/* ------------------------------------------------------------------ */
/*  AST guard analysis                                                */
/* ------------------------------------------------------------------ */

interface AstNode {
  type: string;
  [key: string]: unknown;
}

function isAstNode(v: unknown): v is AstNode {
  return typeof v === 'object' && v !== null && typeof (v as AstNode).type === 'string';
}

function walkAst(node: AstNode, visit: (node: AstNode) => void): void {
  visit(node);
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        if (isAstNode(item)) walkAst(item, visit);
      }
    } else if (isAstNode(value)) {
      walkAst(value, visit);
    }
  }
}

/** Find the first `process.env.X` / `process.env['X']` read inside an expression. */
function findFirstEnvRef(node: AstNode): string | undefined {
  let found: string | undefined;
  walkAst(node, n => {
    if (found !== undefined) return;
    if (n.type !== 'MemberExpression') return;
    const object = n.object as AstNode | undefined;
    if (
      !object ||
      object.type !== 'MemberExpression' ||
      (object.object as AstNode | undefined)?.type !== 'Identifier' ||
      ((object.object as AstNode).name as string) !== 'process' ||
      (object.property as AstNode | undefined)?.type !== 'Identifier' ||
      ((object.property as AstNode).name as string) !== 'env'
    ) {
      return;
    }
    const property = n.property as AstNode | undefined;
    if (property?.type === 'Identifier' && !n.computed) {
      found = property.name as string;
    } else if (property?.type === 'Literal' && typeof property.value === 'string') {
      found = property.value;
    }
  });
  return found;
}

/**
 * Parse a module and figure out, for each detected local-path value, whether
 * every string literal containing it is the fallback arm of a
 * `process.env.X || <literal>` / `??` expression. Returns a map from
 * detected value to guarding env var name. Values with any unguarded
 * occurrence (or inconsistent guards) are absent — the CLI then errors as
 * before, which is the safe default.
 */
function findGuardedValues(ast: AstNode, values: Set<string>): Map<string, string> {
  const stringLiterals: AstNode[] = [];
  const guardedLiterals = new Map<AstNode, string>();

  walkAst(ast, node => {
    if (node.type === 'Literal' && typeof node.value === 'string') {
      stringLiterals.push(node);
      return;
    }
    if (node.type === 'LogicalExpression' && (node.operator === '||' || node.operator === '??')) {
      const right = node.right as AstNode | undefined;
      if (right?.type === 'Literal' && typeof right.value === 'string') {
        const envName = findFirstEnvRef(node.left as AstNode);
        if (envName) guardedLiterals.set(right, envName);
      }
    }
  });

  const result = new Map<string, string>();
  for (const value of values) {
    const containing = stringLiterals.filter(lit => (lit.value as string).includes(value));
    if (containing.length === 0) continue;
    const guards = containing.map(lit => guardedLiterals.get(lit));
    const first = guards[0];
    if (first !== undefined && guards.every(g => g === first)) {
      result.set(value, first);
    }
  }
  return result;
}

/**
 * Rollup plugin that detects host-local storage URLs (e.g. `file:./mastra.db`,
 * `postgres://localhost`) in **user source modules** during bundling, and
 * collects the env vars user code reads via `process.env.X`.
 *
 * Only modules outside `node_modules` (and the deployer's own
 * `.mastra/.build/` pre-bundled files) are inspected, so library code
 * (like Agent Builder prompt templates or JSDoc examples in `@mastra/core`)
 * is naturally excluded.  When `rootDir` is given, modules outside it are
 * also excluded — symlinked dependencies (pnpm `link:`/`file:`) resolve to
 * real paths that never contain `node_modules`.  Tree-shaken modules are
 * excluded via
 * `generateBundle` — only modules that actually contribute rendered code to
 * the output are reported.
 *
 * When a detected literal is the fallback arm of a `process.env.X || literal`
 * expression, `guardedBy: "X"` is recorded so the CLI preflight can apply
 * deploy-time env context instead of hard-erroring on a dead fallback.
 *
 * Two assets are emitted into the output directory for the CLI preflight:
 * - `preflight-metadata.json` — unified metadata (local paths + user env refs)
 * - `preflight-local-paths.json` — legacy shape, kept for one release so an
 *   older globally-installed CLI paired with a newer project-local deployer
 *   doesn't lose the LOCAL_STORAGE_PATH check.
 */
export function localStorageDetector(rootDir?: string): Plugin {
  const userModuleMatches = new Map<string, ModuleMatch[]>();
  const userModuleEnvRefs = new Map<string, Set<string>>();
  const normalizedRoot = rootDir ? rootDir.replace(/\\/g, '/').replace(/\/+$/, '') + '/' : undefined;

  return {
    name: 'mastra-local-storage-detector',

    transform(_code, id) {
      if (id.includes('node_modules')) return null;
      if (MASTRA_BUILD_DIR.test(id)) return null;
      // Modules outside the project/workspace root are dependencies resolved
      // through symlinks (pnpm `link:`, `file:`, monorepo dev setups) whose
      // real path escapes `node_modules` — library code, not user code.
      if (normalizedRoot && !id.replace(/\\/g, '/').startsWith(normalizedRoot)) return null;

      const refs = collectEnvRefs(_code);
      if (refs.size > 0) {
        userModuleEnvRefs.set(id, refs);
      }

      const matches: ModuleMatch[] = [];
      for (const { pattern, hint } of LOCAL_HOST_PATTERNS) {
        const re = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g');
        for (const m of _code.matchAll(re)) {
          matches.push({ value: m[0], hint });
        }
      }

      if (matches.length > 0) {
        // Best-effort structural pass: a parse failure (or a non-Rollup test
        // context without `this.parse`) simply means no `guardedBy`, which
        // preserves the previous always-error behavior.
        try {
          const ast = this.parse(_code) as unknown as AstNode;
          const guarded = findGuardedValues(ast, new Set(matches.map(m => m.value)));
          for (const match of matches) {
            const guardedBy = guarded.get(match.value);
            if (guardedBy) match.guardedBy = guardedBy;
          }
        } catch {
          // ignore — fall back to unguarded detections
        }

        userModuleMatches.set(id, matches);
      }

      return null;
    },

    generateBundle(_, bundle) {
      const detections: LocalStorageDetection[] = [];
      const seen = new Set<string>();
      const userEnvRefs = new Set<string>();

      for (const chunk of Object.values(bundle)) {
        if (chunk.type !== 'chunk') continue;

        for (const [moduleId, moduleInfo] of Object.entries(chunk.modules)) {
          if (moduleInfo.renderedLength === 0) continue;

          for (const ref of userModuleEnvRefs.get(moduleId) ?? []) {
            userEnvRefs.add(ref);
          }

          const matches = userModuleMatches.get(moduleId);
          if (!matches) continue;

          for (const { value, hint, guardedBy } of matches) {
            const key = `${hint}::${value}`;
            if (seen.has(key)) continue;
            seen.add(key);

            detections.push({ value, hint, module: moduleId, ...(guardedBy ? { guardedBy } : {}) });
          }
        }
      }

      const metadata: PreflightMetadata = {
        version: 1,
        localPaths: detections,
        userEnvRefs: [...userEnvRefs].sort(),
      };

      this.emitFile({
        type: 'asset',
        fileName: PREFLIGHT_METADATA_FILE,
        source: JSON.stringify(metadata),
      });

      // Legacy asset — shape unchanged (no `guardedBy`) for older CLIs.
      this.emitFile({
        type: 'asset',
        fileName: LEGACY_LOCAL_PATHS_FILE,
        source: JSON.stringify(detections.map(({ value, hint, module }) => ({ value, hint, module }))),
      });
    },
  };
}
