import fs from 'node:fs';
import path from 'node:path';

function find(root: string, predicate: (file: string) => boolean): string[] {
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(root, entry.name);
    return entry.isDirectory() ? find(file, predicate) : predicate(file) ? [file] : [];
  });
}

export default function verifyKnowledgeProof() {
  const configured = process.env.KNOWLEDGE_PROOF_OUTPUT;
  if (!configured) return;
  const output = path.resolve(configured);
  const artifacts = path.join(output, 'artifacts');
  const required = [
    'results.json',
    'explore.png',
    'imports-completed.png',
    'reader.png',
    'suggester.png',
    'reviewer.png',
  ].map(file => path.join(output, file));
  if (required.some(file => !fs.existsSync(file))) throw new Error('Knowledge proof output is incomplete.');
  if (find(artifacts, file => file.endsWith('trace.zip')).length < 5) {
    throw new Error('Knowledge proof must include a Playwright trace for every journey.');
  }
  if (find(artifacts, file => file.endsWith('.webm')).length < 5) {
    throw new Error('Knowledge proof must include a Playwright video for every journey.');
  }
}
