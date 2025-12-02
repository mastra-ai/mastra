import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { parse } from './parse.js';

export function load(url, context, nextLoad) {
  if (/\.json(5|11)$/i.test(url)) {
    const content = readFileSync(fileURLToPath(url), 'utf8');
    console.log(content);
    return {
      format: 'module',
      shortCircuit: true,
      source: parse(content),
    };
  }

  return nextLoad(url);
}
