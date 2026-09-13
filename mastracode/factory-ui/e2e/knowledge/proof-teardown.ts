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
  const required = [path.join(output, 'results.json'), path.join(output, 'explore.png')];
  if (required.some(file => !fs.existsSync(file))) throw new Error('Knowledge proof output is incomplete.');
  if (find(artifacts, file => file.endsWith('trace.zip')).length === 0) {
    throw new Error('Knowledge proof must include a Playwright trace.');
  }
  if (find(artifacts, file => file.endsWith('.webm')).length === 0) {
    throw new Error('Knowledge proof must include a Playwright video.');
  }
}
