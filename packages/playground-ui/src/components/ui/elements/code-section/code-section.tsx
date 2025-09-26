import { CodeSectionRoot } from './code-section-root';
import { CodeSectionHeader } from './code-section-header';
import { CodeSectionCode } from './code-section-code';

export const CodeSection = Object.assign(CodeSectionRoot, {
  Header: CodeSectionHeader,
  Code: CodeSectionCode,
});
