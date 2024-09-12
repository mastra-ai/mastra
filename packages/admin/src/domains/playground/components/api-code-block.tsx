'use client';

import { useEffect, useState } from 'react';

import { CopyButton } from '@/components/ui/copy-button';

import { CodeBlockDemo } from '@/app/components/code-block';

import parserTypeScript from 'prettier/parser-typescript';
import prettier from 'prettier/standalone';

import { useActionPlaygroundContext } from '../providers/action-playground-provider';

function ApiCodeBlock() {
  const { selectedAction, payload, keplerReferenceId } = useActionPlaygroundContext();
  const selectedActionPlugin = selectedAction?.integrationName;
  const [snippet, setSnippet] = useState<string>('');

  useEffect(() => {
    if (!selectedAction || !selectedActionPlugin) {
      return;
    }

    const referenceIdPart = keplerReferenceId ? `referenceId: "${keplerReferenceId}",` : '// add a referenceId';
    const stringifiedPayload = JSON.stringify(payload, null, 2);

    const snippet = `
import { config } from '@kpl/config';
import { createFramework } from '@kpl/core';\n
const framework = createFramework(config);\n
framework.executeAction({
  integrationName: '${selectedActionPlugin}',
  action: '${selectedAction.type}',
  payload:  {
    data: {
          ${stringifiedPayload.substring(1, stringifiedPayload.length - 1)}
      },
    ctx: {
          ${referenceIdPart}
      },
    },
  });
`;

    try {
      const formatted = prettier.format(snippet, {
        parser: 'typescript',
        plugins: [parserTypeScript],
        semi: true,
        singleQuote: true,
      });
      setSnippet(formatted);
    } catch (error) {
      console.error('Prettier formatting error:', error);
    }
  }, [selectedAction, selectedActionPlugin, payload, keplerReferenceId]);

  return selectedAction ? (
    <section className="group pb-4 max-h-[27rem] overflow-scroll">
      <CopyButton
        snippet={snippet}
        classname="absolute z-40 top-4 right-4 w-8 h-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150 ease-in-out"
      />
      <CodeBlockDemo code={snippet} language="ts" filename="index.ts" />
    </section>
  ) : (
    <></>
  );
}

export { ApiCodeBlock };
