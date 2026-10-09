// Build the app's custom figures on the original skill bench for validation.
// Usage: node preview/build-hairline-checks.mjs <hairline-create skill directory> <output directory>
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
const [skillPath, outputPath] = process.argv.slice(2);
if (!skillPath || !outputPath) throw new Error('Provide the skill directory and an output directory.');
const skill = resolve(skillPath);
const output = resolve(outputPath);
const { assemble } = await import(pathToFileURL(resolve(skill, 'build.mjs')).href);
const figures = resolve(dirname(fileURLToPath(import.meta.url)), '../src/ui/domains/workspaces/figures');
mkdirSync(output, { recursive: true });
for (const scene of ['factory', 'codebase', 'intake', 'setup', 'accounts']) {
  const name = `journey-${scene}`;
  const module = readFileSync(resolve(figures, 'journey.js'), 'utf8');
  const source = module
    .replace("import { HL } from './hairline-kernel';", '')
    .replace("let scene='factory'", `let scene='${scene}'`)
    .replace("name:'journey'", `name:'${name}'`)
    .replace('export default {', 'hairline({')
    .replace(/};\s*$/, '});\n');
  writeFileSync(resolve(output, `${name}.js`), source);
  writeFileSync(resolve(output, `hairline-${name}.html`), assemble(source));
}
