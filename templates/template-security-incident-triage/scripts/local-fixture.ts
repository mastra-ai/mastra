import { sendLocalFixture, type LocalFixtureScenario } from './local-fixture-alert.js';

const scenarios = ['privilege', 'country', 'device'] as const;
const printOnly = process.argv.includes('--print');
const [scenario, ...extra] = process.argv.slice(2).filter(argument => argument !== '--print');

if (!scenarios.includes(scenario as LocalFixtureScenario)) {
  throw new Error(`Usage: npm run fixture:print -- <${scenarios.join('|')}>`);
}
if (extra.length > 0) throw new Error(`Unknown option: ${extra[0]}`);

const result = await sendLocalFixture(scenario as LocalFixtureScenario, {
  printOnly,
});
process.stdout.write(`${JSON.stringify(result.delivered ? result : result.alert, null, 2)}\n`);
