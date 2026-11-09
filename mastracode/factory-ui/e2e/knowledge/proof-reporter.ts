import type { Reporter, TestCase, TestResult } from '@playwright/test/reporter';
import fs from 'node:fs';
import path from 'node:path';

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
      const artifacts = this.#results.flatMap(result => result.artifacts);
      if (!artifacts.some(file => file.endsWith('trace.zip')) || !artifacts.some(file => file.endsWith('.webm'))) {
        throw new Error('Knowledge proof must include a Playwright trace and video.');
      }
      if (!fs.existsSync(path.join(this.#output, 'explore.png'))) {
        throw new Error('Knowledge proof must include explore.png.');
      }
    }
  }
}
