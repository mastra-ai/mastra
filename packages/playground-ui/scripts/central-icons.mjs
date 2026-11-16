import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const iconsDir = resolve(dirname(fileURLToPath(import.meta.url)), '../src/ds/icons/central');
const manifestPath = join(iconsDir, 'central-icons.json');
const maskToken = '__CENTRAL_MASK_ID__';

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const icons = [...new Set([...manifest.icons, ...process.argv.slice(2)])].sort();

if (!process.env.CENTRAL_LICENSE_KEY) {
  throw new Error('Set CENTRAL_LICENSE_KEY to the Mastra Central Icons license key to install the icon package.');
}

const licenseResponse = await fetch('https://centralicons.com/license/check', {
  method: 'POST',
  headers: { Authorization: `Bearer ${process.env.CENTRAL_LICENSE_KEY}` },
  body: JSON.stringify({ package: manifest.package.slice(1), version: manifest.version }),
});
const license = await licenseResponse.json();
if (!license.data?.isValid) {
  throw new Error(`Central Icons rejected CENTRAL_LICENSE_KEY: ${license.error?.message ?? 'invalid license key'}`);
}

const toAttribute = value => {
  if (typeof value === 'string' && value.includes(maskToken)) {
    return `{\`${value.replaceAll(maskToken, '${maskId}')}\`}`;
  }
  if (typeof value === 'string') return JSON.stringify(value);
  return `{${JSON.stringify(value)}}`;
};

const toJsx = (node, Fragment) => {
  if (node === null || node === undefined || node === false) return '';
  if (Array.isArray(node)) return node.map(child => toJsx(child, Fragment)).join('');
  if (typeof node.type !== 'string' && node.type !== Fragment) {
    throw new Error(`Unexpected element type in icon shapes: ${String(node.type)}`);
  }

  const tag = node.type === Fragment ? '' : node.type;
  const { children, ...props } = node.props;
  const attributes = Object.entries(props)
    .map(([key, value]) => ` ${key}=${toAttribute(value)}`)
    .join('');
  const inner = toJsx(children, Fragment);

  return inner ? `<${tag}${attributes}>${inner}</${tag}>` : `<${tag}${attributes} />`;
};

const installDir = mkdtempSync(join(tmpdir(), 'central-icons-'));

try {
  execFileSync(
    'npm',
    ['install', '--no-audit', '--no-fund', `${manifest.package}@${manifest.version}`, 'react@19', 'react-dom@19'],
    { cwd: installDir, stdio: 'inherit' },
  );

  const packageDir = join(installDir, 'node_modules', manifest.package);
  const unknown = icons.filter(name => !existsSync(join(packageDir, name, 'index.mjs')));
  if (unknown.length > 0) {
    throw new Error(`Not in ${manifest.package}@${manifest.version}: ${unknown.join(', ')}`);
  }

  const { Fragment } = await import(pathToFileURL(join(installDir, 'node_modules/react/index.js')).href);

  readdirSync(iconsDir)
    .filter(file => /^Icon\w+\.tsx$/.test(file))
    .forEach(file => rmSync(join(iconsDir, file)));

  for (const name of icons) {
    const module = await import(pathToFileURL(join(packageDir, name, 'index.mjs')).href);
    const element = module[name].type.render({}, null);
    const shapes = element.props.renderShapes ? element.props.renderShapes(maskToken) : element.props.children;
    const jsx = toJsx(shapes, Fragment);
    const body = Array.isArray(shapes) ? `<>${jsx}</>` : jsx;
    const parameter = jsx.includes('${maskId}') ? 'maskId' : '()';

    writeFileSync(
      join(iconsDir, `${name}.tsx`),
      `import { createCentralIcon } from './create-central-icon';\n\nexport const ${name} = createCentralIcon('${name}', ${parameter} => (${body}));\n`,
    );
  }

  writeFileSync(
    join(iconsDir, 'index.ts'),
    [
      `export type { CentralIconProps } from './create-central-icon';`,
      ...icons.map(name => `export { ${name} } from './${name}';`),
      '',
    ].join('\n'),
  );
  writeFileSync(manifestPath, `${JSON.stringify({ ...manifest, icons }, null, 2)}\n`);

  execFileSync('pnpm', ['exec', 'oxfmt', iconsDir], { stdio: 'inherit' });
} finally {
  rmSync(installDir, { recursive: true, force: true });
}
