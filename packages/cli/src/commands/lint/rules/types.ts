export interface LintContext {
  rootDir: string;
  mastraDir: string;
  outputDirectory: string;
  discoveredTools: string[];
  packageJson: {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  mastraPackages: {
    name: string;
    version: string;
    isAlpha: boolean;
  }[];
}

export type LintIssueSeverity = 'error' | 'warning';

export type LintIssueCode =
  | 'MISSING_MASTRA_CORE'
  | 'MISSING_TSCONFIG'
  | 'INVALID_TSCONFIG'
  | 'NEXT_MISSING_SERVER_EXTERNAL_PACKAGES'
  | 'MISSING_ENV_VAR'
  | 'LOCAL_STORAGE_PATH';

export interface LintIssue {
  code: LintIssueCode;
  severity: LintIssueSeverity;
  message: string;
  // string for single-step remediation, string[] when the printer should
  // render one arrow line per option (matches PreflightIssue.fix).
  fix: string | string[];
  scope: 'project' | 'bundle';
}

export interface LintRule {
  name: string;
  description: string;
  run(context: LintContext): Promise<LintIssue[]>;
}
