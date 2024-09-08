'use client';

import { useEffect, useState } from 'react';

import { CopyButton } from '@/components/ui/copy-button';

import { codeToHtml } from 'shiki/bundle/web';

import { useActionPlaygroundContext } from '../providers/action-playground-provider';

function ApiCodeBlock() {
  const { selectedAction, payload, arkwReferenceId } = useActionPlaygroundContext();
  const selectedActionPlugin = selectedAction?.integrationName;
  const [codeBlock, setCodeBlock] = useState<string | null>(null);
  const [snippet, setSnippet] = useState<string>('');

  useEffect(() => {
    if (!selectedAction || !selectedActionPlugin) {
      return;
    }

    const stringifiedPayload = JSON.stringify(payload, null, 10);

    //not formatted too annoyin
    const snippet = `
        import { config } from '@arkw/config';
        import { createFramework } from '@arkw/core';

        const framework = createFramework(config);
        
        framework.executeAction({
          integrationName: '${selectedActionPlugin}',
          action: '${selectedAction.type}',
          payload:  {
              data: {
                ${stringifiedPayload.substring(1, stringifiedPayload.length - 1)}
              },
              ctx: {
                referenceId: ${arkwReferenceId}
              }
          },
        });
      `;

    const getCodeBlock = async () => {
      const html = await codeToHtml(snippet, {
        lang: 'ts',
        defaultColor: false,
        theme: 'vesper',
      });

      return html;
    };

    setSnippet(snippet);
    getCodeBlock().then(html => setCodeBlock(html));
  }, [selectedAction, selectedActionPlugin, payload, arkwReferenceId]);

  return selectedAction ? (
    <section className="group max-h-[27rem] overflow-scroll">
      <CopyButton
        snippet={snippet}
        classname="absolute z-40 top-4 right-4 w-8 h-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150 ease-in-out"
      />
      <CodeSnippet codeBlock={codeBlock as string} />
    </section>
  ) : (
    <></>
  );
}

function CodeSnippet({ codeBlock }: { codeBlock?: string }) {
  return (
    <div
      className="api"
      dangerouslySetInnerHTML={{
        __html: codeBlock || '',
      }}
    />
  );
}

export { ApiCodeBlock };
