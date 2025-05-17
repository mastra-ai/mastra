import { Language } from '../types';

import type { LatexChunkOptions } from '../types';
import { RecursiveCharacterTransformer } from './character';

export class LatexTransformer extends RecursiveCharacterTransformer {
  constructor(options: LatexChunkOptions = {}) {
    const separators = RecursiveCharacterTransformer.getSeparatorsForLanguage(Language.LATEX);
    super({ ...options, separators, isSeparatorRegex: true });
  }
}
