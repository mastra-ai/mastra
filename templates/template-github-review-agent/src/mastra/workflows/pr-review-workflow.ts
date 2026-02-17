import { createWorkflow, createStep } from '@mastra/core/workflows';
import { z } from 'zod';
import { githubFetch, mapPRResponse, fetchAllPRFiles, fetchFileContent } from '../lib/github';
import {
  prIdentifierSchema,
  prSchema,
  fileSchema,
  fileReviewSchema,
  aggregateSummarySchema,
  reviewOutputSchema,
} from '../lib/schemas';
import { SKIP_PATTERNS, MEDIUM_PR_MAX, getReviewDepth, MIN_DELETION_ONLY_LINES } from '../lib/review-config';

/** Max total chars across all files in a single agent call. */
const BATCH_CHAR_BUDGET = 400_000;
/** Max files per agent call. */
const BATCH_FILE_LIMIT = 40;

const prBaseSchema = z.object({
  owner: z.string(),
  repo: z.string(),
  pullNumber: z.number(),
  pr: prSchema,
});

const prContextSchema = prBaseSchema.extend({ files: z.array(fileSchema) });
const categorizedSchema = prBaseSchema.extend({
  reviewableFiles: z.array(fileSchema),
  skippedFiles: z.array(z.string()),
});
const reviewedSchema = prBaseSchema.extend({
  fileReviews: z.array(fileReviewSchema),
  skippedFiles: z.array(z.string()),
});

const fetchPRContext = createStep({
  id: 'fetch-pr-context',
  description: 'Fetch PR metadata and file list from GitHub',
  inputSchema: prIdentifierSchema,
  outputSchema: prContextSchema,
  execute: async ({ inputData }) => {
    const { owner, repo, pullNumber } = inputData;
    const [prResponse, files] = await Promise.all([
      githubFetch(`/repos/${owner}/${repo}/pulls/${pullNumber}`),
      fetchAllPRFiles(owner, repo, pullNumber),
    ]);
    return {
      owner,
      repo,
      pullNumber,
      pr: mapPRResponse(await prResponse.json()),
      files,
    };
  },
});

const categorizeFiles = createStep({
  id: 'categorize-files',
  description: 'Filter non-reviewable files',
  inputSchema: prContextSchema,
  outputSchema: categorizedSchema,
  execute: async ({ inputData }) => {
    const reviewableFiles: z.infer<typeof fileSchema>[] = [];
    const skippedFiles: string[] = [];

    for (const file of inputData.files) {
      if (SKIP_PATTERNS.some(p => p.test(file.filename))) {
        skippedFiles.push(file.filename);
      } else if (file.additions === 0 && file.deletions < MIN_DELETION_ONLY_LINES) {
        skippedFiles.push(file.filename);
      } else {
        reviewableFiles.push(file);
      }
    }

    const { owner, repo, pullNumber, pr } = inputData;
    return { owner, repo, pullNumber, pr, reviewableFiles, skippedFiles };
  },
});

type FileEntry = z.infer<typeof fileSchema> & { content: string };

function buildFileSection(f: FileEntry, includeContent: boolean): string {
  let s = `### ${f.filename} (${f.status}, +${f.additions}/-${f.deletions})\n`;
  if (f.patch) s += `\n**Diff:**\n\`\`\`diff\n${f.patch}\n\`\`\`\n`;
  if (includeContent && f.content) s += `\n**Full file:**\n\`\`\`\n${f.content}\n\`\`\`\n`;
  return s;
}

function batchFiles(files: FileEntry[], includeContent: boolean): FileEntry[][] {
  const batches: FileEntry[][] = [];
  let batch: FileEntry[] = [];
  let chars = 0;

  for (const f of files) {
    const size = buildFileSection(f, includeContent).length;
    if (batch.length > 0 && (chars + size > BATCH_CHAR_BUDGET || batch.length >= BATCH_FILE_LIMIT)) {
      batches.push(batch);
      batch = [];
      chars = 0;
    }
    batch.push(f);
    chars += size;
  }
  if (batch.length > 0) batches.push(batch);
  return batches;
}

const reviewFiles = createStep({
  id: 'review-files',
  description: 'Review files using the code review agent (batched for large PRs)',
  inputSchema: categorizedSchema,
  outputSchema: reviewedSchema,
  execute: async ({ inputData, mastra }) => {
    const { owner, repo, pullNumber, pr, reviewableFiles, skippedFiles } = inputData;
    const agent = mastra.getAgentById('workflow-review-agent');

    const includeContent = reviewableFiles.length <= MEDIUM_PR_MAX;
    const reviewDepth = getReviewDepth(reviewableFiles.length);

    const entries: FileEntry[] = includeContent
      ? await Promise.all(
          reviewableFiles.map(async file => {
            const result = await fetchFileContent(owner, repo, file.filename, pr.headSha);
            return { ...file, content: result?.content ?? '' };
          }),
        )
      : reviewableFiles.map(f => ({ ...f, content: '' }));

    const batches = batchFiles(entries, includeContent);
    const isLargePR = reviewableFiles.length > MEDIUM_PR_MAX;

    function buildPrompt(batch: FileEntry[], batchIndex: number): string {
      const label =
        batches.length === 1
          ? `Files to Review (${entries.length} files)`
          : `Batch ${batchIndex + 1}/${batches.length} (${batch.length} files)`;
      const sections = batch.map(f => buildFileSection(f, includeContent)).join('\n---\n\n');
      return `Review the following PR files. Apply all workspace skills (code-standards, security-review, performance-review).

## PR Context
- **Title:** ${pr.title}
- **Author:** ${pr.author}
- **Branch:** ${pr.headBranch} → ${pr.baseBranch}
- **Description:** ${pr.body || '(no description)'}
- **Stats:** +${pr.additions}/-${pr.deletions} across ${pr.changedFiles} files

## Review Depth
${reviewDepth}

## ${label}

${sections}

For EACH file, return an entry with the filename and an array of issues found (empty array if none). Be specific with line numbers from the diff.`;
    }

    async function reviewBatch(batch: FileEntry[], idx: number) {
      const response = await agent.generate(buildPrompt(batch, idx), {
        structuredOutput: { schema: z.array(fileReviewSchema) },
      });
      return response.object ?? [];
    }

    let allReviews: z.infer<typeof fileReviewSchema>[];

    if (isLargePR) {
      const results = await Promise.all(batches.map((batch, i) => reviewBatch(batch, i)));
      allReviews = results.flat();
    } else {
      allReviews = [];
      for (let i = 0; i < batches.length; i++) {
        allReviews.push(...(await reviewBatch(batches[i], i)));
      }
    }

    return {
      owner,
      repo,
      pullNumber,
      pr,
      fileReviews: allReviews,
      skippedFiles,
    };
  },
});

const aggregateFindings = createStep({
  id: 'aggregate-findings',
  description: 'Synthesize per-file reviews into a cohesive PR review summary',
  inputSchema: reviewedSchema,
  outputSchema: reviewOutputSchema,
  execute: async ({ inputData, mastra }) => {
    const { pr, fileReviews, skippedFiles } = inputData;
    const agent = mastra.getAgentById('workflow-review-agent');

    const issuesSummary = fileReviews
      .filter(fr => fr.issues.length > 0)
      .map(fr => {
        const issues = fr.issues
          .map(
            i => `  - [${i.severity}/${i.category}] ${i.line ? `${fr.filename}:${i.line}` : fr.filename}: ${i.message}`,
          )
          .join('\n');
        return `**${fr.filename}:**\n${issues}`;
      })
      .join('\n\n');

    const prompt = `Synthesize a final PR review from the per-file findings below.

## PR Info
- **Title:** ${pr.title}
- **Author:** ${pr.author}
- **Description:** ${pr.body || '(no description)'}
- **Stats:** +${pr.additions}/-${pr.deletions} across ${pr.changedFiles} files

## Per-File Findings
${issuesSummary || 'No issues found in any file.'}

## Skipped Files
${skippedFiles.length > 0 ? skippedFiles.join(', ') : 'None'}

Rules:
- qualityScore: 1–10
- verdict: REQUEST_CHANGES if critical issues exist, APPROVE if quality is high, COMMENT otherwise
- Be specific with file:line references
- Deduplicate similar issues across files`;

    const response = await agent.generate(prompt, {
      structuredOutput: { schema: aggregateSummarySchema },
    });

    const summary = response.object ?? {
      summary: 'Review could not be generated.',
      qualityScore: 5,
      verdict: 'COMMENT' as const,
      criticalIssues: [],
      securityConcerns: [],
      performanceNotes: [],
      suggestions: [],
      positiveNotes: [],
    };

    return { ...summary, fileReviews, skippedFiles };
  },
});

export const prReviewWorkflow = createWorkflow({
  id: 'pr-review-workflow',
  description: 'Structured PR review: fetch → categorize → review → aggregate',
  inputSchema: prIdentifierSchema,
  outputSchema: reviewOutputSchema,
})
  .then(fetchPRContext)
  .then(categorizeFiles)
  .then(reviewFiles)
  .then(aggregateFindings)
  .commit();
