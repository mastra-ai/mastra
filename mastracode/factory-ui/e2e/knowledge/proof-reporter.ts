import type { Reporter, TestCase, TestResult } from '@playwright/test/reporter';
import fs from 'node:fs';
import path from 'node:path';

const expectedProofTests = [
  'knowledge/explore.spec.ts > explores scoped knowledge and activity',
  'knowledge/governance.spec.ts > Knowledge governance perspectives > when the host vouches only readonly access > shows proposals without mutation actions',
  'knowledge/governance.spec.ts > Knowledge governance perspectives > when the host vouches suggest access without edit authority > keeps review actions unavailable',
  'knowledge/governance.spec.ts > Knowledge governance perspectives > when the host vouches owner authority > persists rejection and conflict re-review through Factory routes',
  'knowledge/imports.spec.ts > observes an agentic import from queue through filtered activity',
];

export default class KnowledgeProofReporter implements Reporter {
  readonly #output: string;
  readonly #results: Array<{ title: string; status: string; artifacts: string[] }> = [];

  constructor(options: { output: string }) {
    this.#output = options.output;
  }

  onTestEnd(test: TestCase, result: TestResult) {
    this.#results.push({
      title: test.titlePath().join(' > '),
      status: result.status,
      artifacts: result.attachments.flatMap(attachment => (attachment.path ? [attachment.path] : [])),
    });
  }

  onEnd() {
    fs.mkdirSync(this.#output, { recursive: true });
    fs.writeFileSync(path.join(this.#output, 'results.json'), JSON.stringify({ tests: this.#results }, null, 2));

    if (process.env.KNOWLEDGE_PROOF_OUTPUT) {
      if (this.#results.length !== expectedProofTests.length) {
        throw new Error(`Knowledge proof must run exactly ${expectedProofTests.length} tests.`);
      }
      for (const expected of expectedProofTests) {
        const result = this.#results.find(candidate => candidate.title.includes(expected));
        if (!result || result.status !== 'passed') {
          throw new Error(`Knowledge proof test did not pass: ${expected}`);
        }
        if (!result.artifacts.some(file => file.endsWith('trace.zip'))) {
          throw new Error(`Knowledge proof test is missing a trace: ${expected}`);
        }
        if (!result.artifacts.some(file => file.endsWith('.webm'))) {
          throw new Error(`Knowledge proof test is missing a video: ${expected}`);
        }
      }
      for (const screenshot of [
        'explore.png',
        'imports-completed.png',
        'reader.png',
        'suggester.png',
        'reviewer.png',
      ]) {
        if (!fs.existsSync(path.join(this.#output, screenshot))) {
          throw new Error(`Knowledge proof is missing ${screenshot}.`);
        }
      }
    }
  }
}
