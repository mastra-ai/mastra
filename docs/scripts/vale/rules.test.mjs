import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { after, before, test } from 'node:test'
import { fileURLToPath } from 'node:url'

const docsRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const stylesPath = join(docsRoot, 'styles')
const binary = join(docsRoot, 'scripts/vale/bin/vale')
const fixtures = [
  {
    rule: 'FigurativeCarries',
    accept: [
      'The request carries metadata.',
      'The signal carries data.',
      'The schema carries the constraint.',
      'The release carries a tag.',
      'The request carries no headers.',
      'The messages carry state.',
      'Fields that carry identifiers are required.',
      'The response carries the same metadata.',
    ],
    reject: ['The design carries baggage.', 'The helper carries the torch.'],
  },
  {
    rule: 'FigurativeWins',
    accept: [
      'The last write wins.',
      'The more specific rule wins.',
      'The scheduler picks a winner.',
      'The higher priority outranks the default.',
    ],
    reject: ['This is a quick win.', 'This solution wins hands down.'],
  },
  {
    rule: 'FigurativeFalls',
    accept: [
      'The value falls within the range.',
      'The count falls below the threshold.',
      'The replica falls behind.',
      'The error falls into this category.',
      'The case falls outside the scope.',
      'Execution falls through to the next case.',
    ],
    reject: ['The design falls flat.', 'The task falls by the wayside.'],
  },
  {
    rule: 'FigurativeSits',
    accept: [
      'The value sits in the buffer.',
      'The cache sits above the storage layer.',
      'The task sits at the top of the queue.',
      'It sits idle.',
      'The setting sits alongside the default.',
      'The middleware sits at the boundary of the application.',
    ],
    reject: ['The feature sits in purgatory.', 'The design sits at the nexus of these systems.'],
  },
  {
    rule: 'FigurativeNouns',
    accept: [
      'Use the tuning knob to adjust retries.',
      'The documented surface includes this method.',
      'Work at a coarser grain.',
      'A cascade of retries exhausts the connection pool.',
    ],
    reject: ['The migration story needs work.', 'There is an extra wrinkle.'],
  },
  {
    rule: 'FigurativeIdioms',
    accept: [
      'Report the measured cost.',
      'The object is out of reach.',
      'Limit the blast radius.',
      'The mock stands in for the service.',
      'The workers run in lockstep.',
      'The versions remain in step with the API.',
      'The query fans out to the workers.',
    ],
    reject: ['The proposal moves the goalposts.', 'The team drinks its own champagne.'],
  },
  {
    rule: 'MotionMetaphors',
    accept: [
      'The output feeds into the next stage.',
      'The server mints a new token.',
      'The default is baked into the image.',
      'The configuration drives the build.',
      'The schema shapes the output.',
      'The server sheds the excess load.',
    ],
    reject: ['The example sheds light on the feature.', 'The parser cracks open the record.'],
  },
  {
    rule: 'EnforcementMetaphors',
    accept: [
      'The permission gates the operation.',
      'Use this flag to gate access.',
      'The hook is armed.',
      'Arming the guard enables the check.',
      'The setting governs whether retries run.',
      'The warning escalates to an error.',
    ],
    reject: ['The check is toothless.', 'The tests keep the implementation honest.'],
  },
  {
    rule: 'EvasionMetaphors',
    accept: [
      'The filter lets it through.',
      'The router routes around the failed service.',
      'The failure goes unreported.',
      'The connection went unused.',
    ],
    reject: ['The change sneaks past validation.', 'The defect snuck through review.'],
  },
  {
    rule: 'ExplainerHeadings',
    accept: ['## How the agent loop works', '## When the processor runs', '## Why the cache expires'],
    reject: ['## Under the hood', '## Deep dive'],
  },
  {
    rule: 'ExplainerLeads',
    severity: 'suggestion',
    accept: [
      'This is why the cache expires.',
      'What the hook does: validates input.',
      '## What the hook does is documented',
    ],
    reject: ['What the hook does is validate input.'],
  },
  {
    rule: 'ShellNounCopula',
    severity: 'suggestion',
    accept: [
      'The assumption is that the caller is authenticated.',
      'The difference is that the second call uses cached data.',
      'The risk is that the token expires.',
      'The question is whether retries are safe.',
      'The caveat is that the request can time out.',
    ],
    reject: ['The thing is that the cache expires.', 'The upshot is that the request fails.'],
  },
  {
    rule: 'RestatementMarkers',
    severity: 'suggestion',
    accept: [
      'To be more precise, the limit applies per request.',
      'To clarify, the value is optional.',
      'In plain English, this setting disables retries.',
      'The same applies to writes.',
      'In practice, the cache handles most requests.',
      'In effect, the operation is read-only.',
    ],
    reject: ['Simply put, the cache expires.', 'Put another way, the operation is read-only.'],
  },
  {
    rule: 'StackedAnaphora',
    severity: 'suggestion',
    accept: [
      'An unset value uses the default. A configured value overrides it.',
      'For reads, the cache handles requests. For writes, the database stores changes.',
      'No arguments are required. No results are returned.',
      'A processor validates input. A tool executes the request. An agent returns the result.',
      'No setup.\n\nNo config.\n\nNo fuss.',
    ],
    reject: ['No setup. No config. No fuss.', 'No setup, no config, no fuss.'],
  },
]
const disabled = [
  ['FigurativeStays', 'The stream stays open.'],
  ['FigurativeKeeps', 'The cache keeps the results deterministic.'],
  ['FigurativeFires', 'The hook fires on every run.'],
  ['FigurativeSurfaces', 'The client surfaces errors to the caller.'],
  ['FigurativeLives', 'The configuration lives in the project directory.'],
  ['FigurativeTravels', 'The request travels through the middleware.'],
  ['MortalityMetaphors', 'The cache entry outlives the request.'],
  ['VerbTricolon', 'You validate input, execute tools, and return results.'],
  ['ConsequenceParticiple', 'The check rejects the request, preventing the write.'],
  ['CoordinatedReveal', 'The request completes, and only the caller receives the result.'],
  ['StrawmanContrast', 'The cache stores one entry, not one per caller.'],
  ['NegatedPair', 'The operation supports neither reads nor writes.'],
  ['AnthropomorphicAdjectives', 'The connection is healthy.'],
]
let directory
let isolatedConfig
let projectConfig
let fileNumber = 0

before(() => {
  const version = spawnSync(binary, ['--version'], { encoding: 'utf8' })
  assert.equal(version.status, 0, 'Vale is required. Run pnpm vale:download from docs first.')
  directory = mkdtempSync(join(tmpdir(), 'mastra-vale-rules-'))
  isolatedConfig = join(directory, 'isolated.ini')
  projectConfig = join(directory, 'project.ini')
  writeFileSync(
    isolatedConfig,
    `StylesPath = ${stylesPath}\nMinAlertLevel = suggestion\n[*.mdx]\nBasedOnStyles = ai-tells-overrides\n`,
  )
  writeFileSync(
    projectConfig,
    readFileSync(join(docsRoot, '.vale.ini'), 'utf8').replace(/^StylesPath = .*$/m, `StylesPath = ${stylesPath}`),
  )
})

after(() => {
  if (directory) rmSync(directory, { recursive: true, force: true })
})

function lint(text, config = isolatedConfig, family = 'docs', minLevel = 'suggestion') {
  const file = join(directory, 'src/content/en', family, `fixture-${fileNumber++}.mdx`)
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, `${text}\n`)
  const result = spawnSync(binary, [`--config=${config}`, '--output=JSON', `--minAlertLevel=${minLevel}`, file], {
    cwd: docsRoot,
    encoding: 'utf8',
    timeout: 10000,
  })
  assert.ifError(result.error)
  assert.ok(result.status === 0 || result.status === 1, result.stderr || result.stdout)
  const output = JSON.parse(result.stdout)
  assert.ok(!output.Code, JSON.stringify(output))
  return Object.values(output).flat()
}

test('every project-owned rule has accepted and rejected fixtures', () => {
  const rules = readdirSync(join(stylesPath, 'ai-tells-overrides'))
    .filter(file => file.endsWith('.yml'))
    .map(file => file.slice(0, -4))
    .sort()
  assert.deepEqual(rules, fixtures.map(fixture => fixture.rule).sort())
})

for (const fixture of fixtures) {
  test(`${fixture.rule}: accepts technical wording`, () => {
    assert.deepEqual(lint(fixture.accept.join('\n\n')), [])
  })
  test(`${fixture.rule}: detects retained wording`, () => {
    for (const text of fixture.reject) {
      const alerts = lint(text)
      assert.ok(
        alerts.some(alert => alert.Check === `ai-tells-overrides.${fixture.rule}`),
        text,
      )
      assert.ok(
        alerts.every(alert => alert.Severity === (fixture.severity ?? 'error')),
        text,
      )
    }
  })
}

for (const family of ['docs', 'reference']) {
  test(`project configuration enables replacements without duplicate upstream alerts in ${family}`, () => {
    const alerts = lint(fixtures.flatMap(fixture => fixture.reject).join('\n\n'), projectConfig, family)
    for (const fixture of fixtures) {
      assert.ok(
        alerts.some(alert => alert.Check === `ai-tells-overrides.${fixture.rule}`),
        fixture.rule,
      )
      assert.ok(!alerts.some(alert => alert.Check === `ai-tells.${fixture.rule}`), fixture.rule)
    }
  })
  test(`project configuration disables broad rules in ${family}`, () => {
    const alerts = lint(disabled.map(([, text]) => text).join('\n\n'), projectConfig, family)
    for (const [rule] of disabled) {
      assert.ok(!alerts.some(alert => alert.Check === `ai-tells.${rule}`), rule)
    }
  })
}

test('advisory rules do not fail the error-only lint gate', () => {
  const advisory = fixtures.filter(fixture => fixture.severity === 'suggestion')
  const alerts = lint(advisory.flatMap(fixture => fixture.reject).join('\n\n'), isolatedConfig, 'docs', 'error')
  assert.deepEqual(alerts, [])
})
