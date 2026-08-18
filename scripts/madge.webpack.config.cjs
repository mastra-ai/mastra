/**
 * Webpack config consumed by madge (via enhanced-resolve) for the
 * affected-tests analyzer.
 *
 * Workspace package names and exported subpaths are aliased to TypeScript
 * sources. This, combined with emptying `exportsFields` / `mainFields` /
 * `aliasFields`, forces resolution onto source files instead of bundled `dist/`
 * output — which lets madge trace through the workspace at the source level.
 */

const { join } = require('node:path');
const { buildWorkspaceSourceAliases } = require('./workspace-source-aliases.cjs');

const ROOT = join(__dirname, '..');

const alias = buildWorkspaceSourceAliases(ROOT).map(({ name, target, exact }) => ({
  name,
  alias: target,
  onlyModule: exact,
}));

module.exports = {
  resolve: {
    alias,
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json'],
    exportsFields: [],
    mainFields: [],
    aliasFields: [],
  },
};
