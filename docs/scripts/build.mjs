// Builds the docs site. The release workflow sets DOCS_SKIP_MINIFY because it
// only needs the llms.txt files and manifest the build writes, to embed docs in
// the published packages. Those files are the same with or without minifying,
// and skipping it roughly halves the build. The deployed site keeps minifying.
import { spawnSync } from 'node:child_process'

const args = ['build', ...process.argv.slice(2)]
if (process.env.DOCS_SKIP_MINIFY === 'true') args.push('--no-minify')

const result = spawnSync('docusaurus', args, { stdio: 'inherit', shell: process.platform === 'win32' })
process.exit(result.status ?? 1)
