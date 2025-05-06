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

export interface LintRule {
  name: string;
  description: string;
  run(context: LintContext): Promise<boolean>;
}

export interface LintResult {
  success: boolean;
  errors: string[];
  warnings: string[];
}
