import CodeMirror, { EditorView } from '@uiw/react-codemirror';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';

import { githubDarkInit } from '@uiw/codemirror-theme-github';
import { useAgentPromptExperiment } from '../../context';

export const PromptEnhancer = (_props: { agentId: string }) => {
  const { prompt } = useAgentPromptExperiment();

  return (
    <div className="rounded-md bg-surface4 p-1 font-mono">
      <CodeMirror
        value={prompt}
        editable={false}
        extensions={[markdown({ base: markdownLanguage, codeLanguages: languages }), EditorView.lineWrapping]}
        theme={githubDarkInit({
          settings: {
            caret: '#c6c6c6',
            fontFamily: 'monospace',
            background: 'transparent',
            gutterBackground: 'transparent',
            gutterForeground: '#939393',
            gutterBorder: 'none',
          },
        })}
      />
    </div>
  );
};
