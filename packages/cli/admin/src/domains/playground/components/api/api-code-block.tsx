'use client';

import { useEffect, useState } from 'react';

import { CodeBlockDemo } from '@/components/code-block';
import { CopyButton } from '@/components/ui/copy-button';

import * as parserTypeScript from 'prettier/parser-typescript';
import * as prettierPluginEstree from 'prettier/plugins/estree';
import * as prettier from 'prettier/standalone';

import { useApiPlaygroundContext } from '../../context/api-playground-context';

function ApiCodeBlock() {
  const { selectedApi, payload, mastraConnectionId } = useApiPlaygroundContext();
  const selectedApiPlugin = selectedApi?.integrationName;
  const [snippet, setSnippet] = useState<string>('');

  useEffect(() => {
    if (!selectedApi || !selectedApiPlugin) {
      return;
    }

    const connectionIdPart = mastraConnectionId ? `connectionId: "${mastraConnectionId}",` : '// add a connectionId';
    const stringifiedPayload = JSON.stringify(payload, null, 2);

    const snippet = `
import { config } from '@mastra/config';
import { createFramework } from '@mastra/core';\n
const framework = createFramework(config);\n
framework.executeAction({
  integrationName: '${selectedApiPlugin}',
  action: '${selectedApi.type}',
  payload:  {
    data: {
          ${stringifiedPayload.substring(1, stringifiedPayload.length - 1)}
      },
    ctx: {
          ${connectionIdPart}
      },
    },
  });
`;

    //TODO: fix formatting for very long strings
    const formatCode = async () => {
      try {
        const formatted = await prettier.format(snippet, {
          parser: 'typescript',
          plugins: [parserTypeScript, prettierPluginEstree],
          semi: true,
          singleQuote: true,
        });
        setSnippet(formatted);
      } catch (error) {
        console.error('Prettier formatting error:', error);
      }
    };

    formatCode();
  }, [selectedApi, selectedApiPlugin, payload, mastraConnectionId]);

  return selectedApi ? (
    <section className="group pb-4 max-h-[24rem] overflow-scroll">
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
