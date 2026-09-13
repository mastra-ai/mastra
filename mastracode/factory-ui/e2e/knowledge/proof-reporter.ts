import type { FullConfig, FullResult, Reporter, Suite, TestCase, TestResult } from '@playwright/test/reporter';
import fs from 'node:fs';
import path from 'node:path';

const proofGroups = [
  {
    files: ['explore.spec.ts', 'governance.spec.ts', 'imports.spec.ts'],
    tests: [
      'knowledge/explore.spec.ts > renders scoped knowledge and activity from sanitized network fixtures',
      'knowledge/governance.spec.ts > Knowledge governance perspectives > when the host vouches only readonly access > shows proposals without mutation actions',
      'knowledge/governance.spec.ts > Knowledge governance perspectives > when the host vouches suggest access without edit authority > keeps review actions unavailable',
      'knowledge/governance.spec.ts > Knowledge governance perspectives > when the host vouches owner authority > persists rejection and conflict re-review through Factory routes',
      'knowledge/imports.spec.ts > renders an agentic import journey from sanitized network fixtures',
    ],
    screenshots: ['explore.png', 'imports-completed.png', 'reader.png', 'suggester.png', 'reviewer.png'],
  },
  {
    files: ['curation.spec.ts'],
    tests: [
      'knowledge/curation.spec.ts > Knowledge curation workflow > when an owner curates independent provisional items > applies refine, merge, retain, discard, and promote through real routes and LibSQL',
      'knowledge/curation.spec.ts > Knowledge curation workflow > when a suggest-only curator requests promotion > creates a review proposal and opens it in Approvals',
    ],
    screenshots: ['curation-owner.png', 'curation-suggest.png'],
  },
  {
    files: ['canvas.spec.ts'],
    tests: [
      'knowledge/canvas.spec.ts > Knowledge graph canvas > when an authorized user explores a large scope lens > selects a bounded lens, preserves cycles and privacy, and navigates an adjacent scope',
    ],
    screenshots: ['canvas-boundary.png'],
  },
];

export default class KnowledgeProofReporter implements Reporter {
  readonly #output: string;
  readonly #results: Array<{ title: string; status: string; artifacts: string[] }> = [];
  #groups: typeof proofGroups = [];

  constructor(options: { output: string }) {
    this.#output = options.output;
  }

  onBegin(_config: FullConfig, suite: Suite) {
    const files = new Set(suite.allTests().map(test => path.basename(test.location.file)));
    this.#groups = proofGroups.filter(group => group.files.some(file => files.has(file)));
  }

  onTestEnd(test: TestCase, result: TestResult) {
    this.#results.push({
      title: test.titlePath().join(' > '),
      status: result.status,
      artifacts: result.attachments.flatMap(attachment => (attachment.path ? [attachment.path] : [])),
    });
  }

  onEnd(): { status: FullResult['status'] } | undefined {
    fs.mkdirSync(this.#output, { recursive: true });
    const errors: string[] = [];
    if (process.env.KNOWLEDGE_PROOF_OUTPUT) {
      const expectedTests = this.#groups.flatMap(group => group.tests);
      if (!expectedTests.length || this.#results.length !== expectedTests.length) {
        errors.push(`Knowledge proof must run exactly ${expectedTests.length} selected-group tests.`);
      }
      for (const expected of expectedTests) {
        const result = this.#results.find(candidate => candidate.title.includes(expected));
        if (!result || result.status !== 'passed') errors.push(`Knowledge proof test did not pass: ${expected}`);
        for (const suffix of ['trace.zip', '.webm']) {
          if (!result?.artifacts.some(file => file.endsWith(suffix) && fs.existsSync(file))) {
            errors.push(`Knowledge proof test is missing ${suffix}: ${expected}`);
          }
        }
      }
      for (const screenshot of this.#groups.flatMap(group => group.screenshots)) {
        if (!fs.existsSync(path.join(this.#output, screenshot)))
          errors.push(`Knowledge proof is missing ${screenshot}.`);
      }
    }
    fs.writeFileSync(
      path.join(this.#output, 'results.json'),
      JSON.stringify({ tests: this.#results, errors }, null, 2),
    );
    if (errors.length) {
      console.error(errors.join('\n'));
      return { status: 'failed' };
    }
  }
}
