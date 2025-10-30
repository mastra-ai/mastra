import { Language } from '../types';
import type { BaseChunkOptions } from '../types';

import { RecursiveCharacterTransformer } from './character';

export class LatexTransformer extends RecursiveCharacterTransformer {
  constructor(options: BaseChunkOptions = {}) {
    const separators = RecursiveCharacterTransformer.getSeparatorsForLanguage(Language.LATEX);
    super({ ...options, separators, isSeparatorRegex: true });
  }
}
