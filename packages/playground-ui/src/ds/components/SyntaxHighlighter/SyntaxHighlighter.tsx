import { PrismAsyncLight } from 'react-syntax-highlighter';
import { makePrismAsyncLightSyntaxHighlighter } from '@assistant-ui/react-syntax-highlighter';

import tsx from 'react-syntax-highlighter/dist/esm/languages/prism/tsx';
import python from 'react-syntax-highlighter/dist/esm/languages/prism/python';

import { coldarkDark } from 'react-syntax-highlighter/dist/cjs/styles/prism';

// register languages you want to support
PrismAsyncLight.registerLanguage('js', tsx);
PrismAsyncLight.registerLanguage('jsx', tsx);
PrismAsyncLight.registerLanguage('ts', tsx);
PrismAsyncLight.registerLanguage('tsx', tsx);
PrismAsyncLight.registerLanguage('python', python);

export const SyntaxHighlighter = makePrismAsyncLightSyntaxHighlighter({
  style: coldarkDark,
  customStyle: {
    margin: 0,
    width: '100%',
    background: 'black',
    padding: '1.5rem 1rem',
  },
});
