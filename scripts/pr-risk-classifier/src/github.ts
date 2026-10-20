import { Octokit } from 'octokit';
import type { PullFile } from './types.ts';

export type PullSummary = { number: number; title: string; body: string | null; draft: boolean; labels: string[] };
export type IssueComment = { id: number; body: string; author: string };
export type LabelDefinition = { name: string; color: string; description: string };

/** The GitHub operations the classifier needs, all scoped to one pull request. */
export interface PullRequestApi {
  getPull(): Promise<PullSummary>;
  listFiles(): Promise<PullFile[]>;
  listComments(): Promise<IssueComment[]>;
  createComment(body: string): Promise<void>;
  updateComment(id: number, body: string): Promise<void>;
  ensureLabel(label: LabelDefinition): Promise<void>;
  addLabel(name: string): Promise<void>;
  removeLabel(name: string): Promise<void>;
}

export function octokitPullRequestApi(input: { token: string; owner: string; repo: string; number: number }): PullRequestApi {
  const octokit = new Octokit({ auth: input.token });
  const repo = { owner: input.owner, repo: input.repo };
  const issue = { ...repo, issue_number: input.number };

  return {
    async getPull() {
      const { data } = await octokit.rest.pulls.get({ ...repo, pull_number: input.number });
      return {
        number: data.number,
        title: data.title,
        body: data.body,
        draft: data.draft === true,
        labels: data.labels.map(l => l.name),
      };
    },
    async listFiles() {
      // Reading the diff from the API keeps untrusted PR code off the runner.
      const files = await octokit.paginate(octokit.rest.pulls.listFiles, { ...repo, pull_number: input.number, per_page: 100 });
      return files.map(f => ({
        filename: f.filename,
        status: f.status,
        additions: f.additions,
        deletions: f.deletions,
        sha: f.sha,
        patch: f.patch,
        previous_filename: f.previous_filename,
      }));
    },
    async listComments() {
      const comments = await octokit.paginate(octokit.rest.issues.listComments, { ...issue, per_page: 100 });
      return comments.map(c => ({ id: c.id, body: c.body ?? '', author: c.user?.login ?? '' }));
    },
    async createComment(body) {
      await octokit.rest.issues.createComment({ ...issue, body });
    },
    async updateComment(id, body) {
      await octokit.rest.issues.updateComment({ ...repo, comment_id: id, body });
    },
    async ensureLabel(label) {
      try {
        await octokit.rest.issues.createLabel({ ...repo, ...label });
      } catch (error) {
        if (statusOf(error) !== 422) throw error;
        await octokit.rest.issues.updateLabel({ ...repo, ...label });
      }
    },
    async addLabel(name) {
      await octokit.rest.issues.addLabels({ ...issue, labels: [name] });
    },
    async removeLabel(name) {
      try {
        await octokit.rest.issues.removeLabel({ ...issue, name });
      } catch (error) {
        if (statusOf(error) !== 404) throw error;
      }
    },
  };
}

function statusOf(error: unknown): number | undefined {
  return typeof error === 'object' && error !== null && 'status' in error ? Number(error.status) : undefined;
}
