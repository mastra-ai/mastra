import { describe, expect, it } from 'vitest';

import { queryKeys } from '../keys';

describe('GitLab query keys', () => {
  it('partitions cached data by API base URL', () => {
    const firstBaseUrl = 'https://first.example.com';
    const secondBaseUrl = 'https://second.example.com';

    expect(queryKeys.gitlabStatus(firstBaseUrl)).not.toEqual(queryKeys.gitlabStatus(secondBaseUrl));
    expect(queryKeys.gitlabProjects(firstBaseUrl)).not.toEqual(queryKeys.gitlabProjects(secondBaseUrl));
    expect(queryKeys.gitlabIssues(firstBaseUrl, 'factory-1', 'work')).not.toEqual(
      queryKeys.gitlabIssues(secondBaseUrl, 'factory-1', 'work'),
    );
    expect(queryKeys.gitlabIssue(firstBaseUrl, 'factory-1', 'issue-1')).not.toEqual(
      queryKeys.gitlabIssue(secondBaseUrl, 'factory-1', 'issue-1'),
    );
  });
});
