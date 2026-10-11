import { resolve } from 'node:path';
import { generateCorpus } from '../tests/fixtures/corpus.ts';

const destination = resolve('.runtime/demo');
await generateCorpus(destination);
console.log('Originally authored fictional Northstar Tasks corpus written to .runtime/demo.');
