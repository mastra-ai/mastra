import { mastraCoreRule } from './mastraCoreRule.js';
import { mastraDepsCompatibilityRule } from './mastraDepsCompatibilityRule.js';
import { nextConfigRule } from './nextConfigRule.js';
import { tsConfigRule } from './tsConfigRule.js';
import type { LintRule } from './types.js';

export const rules: LintRule[] = [nextConfigRule, tsConfigRule, mastraCoreRule, mastraDepsCompatibilityRule];
