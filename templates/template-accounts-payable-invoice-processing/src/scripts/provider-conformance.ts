import { runProviderConformance } from '../mastra/phase2/conformance.ts';
import { fixtureConformanceCases } from '../mastra/phase2/conformance-fixtures.ts';
import { fixtureProvider } from '../mastra/phase2/providers/fixture-provider.ts';

const report = await runProviderConformance(fixtureProvider, fixtureConformanceCases);
console.log(`${report.providerId}: ${report.checks.length} conformance checks passed`);
report.checks.forEach(check => console.log(`- ${check}`));
