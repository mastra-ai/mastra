import type { RuleGroup } from '../rules/rule-group.js';

/**
 * The built-in "needs a person" condition: a GitHub or GitLab card whose author is not
 * trusted (no `authorTrusted` or `factoryAuthored` stamp). A missing stamp fails closed.
 */
export const UNTRUSTED_AUTHOR_WHEN: RuleGroup = {
  operator: 'AND',
  conditions: [
    { field: 'source.integration', operator: 'in', value: ['github', 'gitlab'] },
    { field: 'author.trusted', operator: 'not_equals', value: true },
  ],
};
