import { Language } from '../types';

import { RecursiveCharacterTransformer } from './character';

export class LatexTransformer extends RecursiveCharacterTransformer {
  constructor(
    options: {
      size?: number;
      overlap?: number;
      lengthFunction?: (text: string) => number;
      keepSeparator?: boolean | 'start' | 'end';
      addStartIndex?: boolean;
      stripWhitespace?: boolean;
    } = {},
  ) {
    const separators = RecursiveCharacterTransformer.getSeparatorsForLanguage(Language.LATEX);
    super({ separators, isSeparatorRegex: true, options });
  }
}
