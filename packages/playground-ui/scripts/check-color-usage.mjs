import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const sourceExtensions = new Set(['.cjs', '.css', '.html', '.js', '.jsx', '.mdx', '.mjs', '.scss', '.ts', '.tsx']);
const legacyTokenPattern = '(?:surface[1-6]|neutral[1-6]|border[12]|text1)';
const semanticTokenPattern =
  '(?:sidebar-accent-foreground|popover-foreground|secondary-foreground|tertiary-foreground|disabled-foreground|contrast-foreground|sidebar-foreground|sidebar-accent|sidebar-border|sidebar-divider|sidebar-ring|card-foreground|muted-foreground|accent-foreground|background|secondary|foreground|selected|popover|sidebar|accent|border|input|muted|card|ring)';
const foundationTokenPattern = '(?:background-[1-3]|gray-(?:10|[1-9])|gray-alpha-(?:10|[1-9]))';
const colorUtilityPattern = '(?:bg|text|border|ring|outline|fill|stroke|from|via|to)';
const approvedFoundationFiles = new Set(['packages/playground-ui/theme.css']);
const tokenContractFiles = new Set([
  'packages/playground-ui/theme.css',
  'packages/playground-ui/src/ds/tokens/colors.ts',
]);

const normalizePath = value => value.split(sep).join('/');

const parseArguments = argv => {
  const options = { roots: [], component: '' };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === '--report') continue;

    if (argument === '--root' || argument === '--component') {
      const value = argv[index + 1];
      if (!value) throw new Error(`${argument} requires a value.`);
      index += 1;

      if (argument === '--root') options.roots.push(value);
      if (argument === '--component') options.component = value;
      continue;
    }

    throw new Error(`Unknown argument: ${argument}`);
  }

  return options;
};

const runGit = (repositoryRoot, args) => {
  const result = spawnSync('git', ['-C', repositoryRoot, ...args], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr.trim() || 'Git command failed.');
  return result.stdout;
};

const findRepositoryRoot = cwd => runGit(cwd, ['rev-parse', '--show-toplevel']).trim();

const listTrackedFiles = (repositoryRoot, roots) => {
  const relativeRoots = roots.map(
    root => normalizePath(relative(repositoryRoot, resolve(repositoryRoot, root))) || '.',
  );
  const output = runGit(repositoryRoot, ['ls-files', '-z', '--', ...relativeRoots]);

  return output
    .split('\0')
    .filter(Boolean)
    .filter(file => !file.startsWith('packages/playground-ui/scripts/'))
    .filter(file => sourceExtensions.has(file.slice(file.lastIndexOf('.'))))
    .sort();
};

const classifyFile = file => {
  if (tokenContractFiles.has(file)) return 'tokens';
  if (/(?:^|\/)\.storybook(?:\/|$)|\.stories\.[^.]+$/.test(file)) return 'stories';
  if (/(?:^|\/)__tests__(?:\/|$)|\.(?:test|spec)\.[^.]+$/.test(file)) return 'tests';
  return 'production';
};

const componentMatches = (file, component) => {
  if (!component) return true;
  const normalized = component.toLowerCase();
  const segments = file.toLowerCase().split('/');
  return segments.includes(normalized) || segments.some(segment => segment.startsWith(`${normalized}.`));
};

const findMatches = (content, pattern, tokenAt, onMatch) => {
  for (const match of content.matchAll(pattern)) {
    const token = tokenAt(match);
    if (token) onMatch(token, match[0]);
  }
};

const achromaticHex = value => {
  const hex = value.slice(1);
  const expanded =
    hex.length === 3 || hex.length === 4
      ? hex
          .split('')
          .map(character => character.repeat(2))
          .join('')
      : hex;
  if (expanded.length !== 6 && expanded.length !== 8) return false;
  return expanded.slice(0, 2) === expanded.slice(2, 4) && expanded.slice(2, 4) === expanded.slice(4, 6);
};

const achromaticFunctionalColor = value => {
  const normalized = value.toLowerCase();

  if (normalized.startsWith('oklch(')) {
    return /^oklch\(\s*(?:\d*\.)?\d+%?\s+0(?:\.0+)?%?(?:\s|\/|\))/.test(normalized);
  }

  if (normalized.startsWith('hsl')) {
    const numbers = normalized.match(/-?(?:\d*\.)?\d+%?/g) ?? [];
    return numbers[1]?.replace('%', '') === '0';
  }

  const numbers = normalized.match(/-?(?:\d*\.)?\d+%?/g) ?? [];
  if (numbers.length < 3) return false;
  return numbers[0] === numbers[1] && numbers[1] === numbers[2];
};

const scanFile = (repositoryRoot, file) => {
  const content = readFileSync(resolve(repositoryRoot, file), 'utf8');
  const records = new Map();
  const add = (token, form, kind) => {
    const key = `${kind}\u0000${form}\u0000${token}`;
    const current = records.get(key) ?? { file, token, form, kind, count: 0 };
    current.count += 1;
    records.set(key, current);
  };

  findMatches(
    content,
    new RegExp(`\\b${colorUtilityPattern}-(${legacyTokenPattern})(?:\\/[0-9.]+)?\\b`, 'g'),
    match => match[1],
    token => add(token, 'tailwind', 'legacy'),
  );
  findMatches(
    content,
    new RegExp(`var\\(\\s*--(${legacyTokenPattern})(?![\\w-])[^)]*\\)`, 'g'),
    match => match[1],
    token => add(token, 'css-variable', 'legacy'),
  );
  findMatches(
    content,
    new RegExp(
      `\\b(?:Colors|BorderColors)\\s*(?:\\.\\s*(${legacyTokenPattern})(?![\\w-])|\\[\\s*['"](${legacyTokenPattern})['"]\\s*\\])`,
      'g',
    ),
    match => match[1] ?? match[2],
    token => add(token, 'typescript', 'legacy'),
  );
  findMatches(
    content,
    new RegExp(`\\b${colorUtilityPattern}-(${semanticTokenPattern})(?:\\/[0-9.]+)?(?=$|[^\\w-])`, 'g'),
    match => match[1],
    token => add(token, 'tailwind', 'semantic'),
  );
  findMatches(
    content,
    new RegExp(`var\\(\\s*--(${semanticTokenPattern})(?![\\w-])[^)]*\\)`, 'g'),
    match => match[1],
    token => add(token, 'css-variable', 'semantic'),
  );
  findMatches(
    content,
    new RegExp(
      `\\b(?:Colors|BorderColors)\\s*(?:\\.\\s*(${semanticTokenPattern})(?![\\w-])|\\[\\s*['"](${semanticTokenPattern})['"]\\s*\\])`,
      'g',
    ),
    match => match[1] ?? match[2],
    token => add(token, 'typescript', 'semantic'),
  );

  if (!approvedFoundationFiles.has(file)) {
    findMatches(
      content,
      new RegExp(
        `\\b${colorUtilityPattern}-(?:(${foundationTokenPattern})|\\(\\s*--(${foundationTokenPattern})\\s*\\))(?:\\/[0-9.]+)?(?=$|[^\\w-])`,
        'g',
      ),
      match => match[1] ?? match[2],
      token => add(token, 'tailwind', 'foundation'),
    );
    findMatches(
      content,
      new RegExp(`var\\(\\s*--(${foundationTokenPattern})(?![\\w-])[^)]*\\)`, 'g'),
      match => match[1],
      token => add(token, 'css-variable', 'foundation'),
    );
  }

  if (!approvedFoundationFiles.has(file)) {
    findMatches(
      content,
      /#[\da-fA-F]{3,8}\b/g,
      match => match[0].toLowerCase(),
      (token, value) => {
        if (achromaticHex(value)) add(token, 'literal', 'achromatic');
      },
    );
    findMatches(
      content,
      /\b(?:rgb|rgba|hsl|hsla|oklch)\([^)]*\)/gi,
      match => match[0].toLowerCase().replace(/\s+/g, ' '),
      (token, value) => {
        if (achromaticFunctionalColor(value)) add(token, 'literal', 'achromatic');
      },
    );
    findMatches(
      content,
      /\bcolor-mix\([^)]*\)/gi,
      match => match[0].toLowerCase().replace(/\s+/g, ' '),
      (token, value) => {
        if (new RegExp(`--(?:${legacyTokenPattern}|${foundationTokenPattern})\\b`).test(value)) {
          add(token, 'literal', 'achromatic');
        }
      },
    );
  }

  return [...records.values()];
};

const sortRecords = records =>
  records.sort(
    (left, right) =>
      left.file.localeCompare(right.file) ||
      left.token.localeCompare(right.token) ||
      left.form.localeCompare(right.form) ||
      left.kind.localeCompare(right.kind),
  );

const buildReport = ({ repositoryRoot, roots, component = '' }) => {
  const groups = { production: [], tests: [], stories: [], tokens: [] };
  const files = listTrackedFiles(repositoryRoot, roots).filter(file => componentMatches(file, component));

  for (const file of files) {
    groups[classifyFile(file)].push(...scanFile(repositoryRoot, file));
  }

  for (const records of Object.values(groups)) sortRecords(records);

  return {
    version: 1,
    roots: roots.map(root => normalizePath(root)),
    component: component || null,
    groups,
    summary: Object.fromEntries(
      Object.entries(groups).map(([group, records]) => [
        group,
        records.reduce((total, record) => total + record.count, 0),
      ]),
    ),
  };
};

const main = argv => {
  const options = parseArguments(argv);
  const repositoryRoot = findRepositoryRoot(process.cwd());
  const roots = options.roots.length ? options.roots : ['packages/playground-ui', 'packages/playground'];
  const report = buildReport({ repositoryRoot, roots, component: options.component });

  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
};

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}

export { buildReport, parseArguments, scanFile };
