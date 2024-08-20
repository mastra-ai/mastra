'use client';

import { useEffect, useState } from 'react';

import { codeToHtml } from 'shiki/bundle/web';

import { useActionPlaygroundContext } from '../providers/action-playground-provider';

function ActionDetail() {
  const { selectedAction, payload } = useActionPlaygroundContext();
  const selectedActionPlugin = selectedAction?.integrationName;
  const [codeBlock, setCodeBlock] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedAction || !selectedActionPlugin) {
      return;
    }

    const stringifiedPayload = JSON.stringify(payload, null, 10);

    const snippet = `
        'use server';

        import frameworkInstance from 'path-to-framework-instance';

         
        frameworkInstance.executeAction({
          pluginName: '${selectedActionPlugin}',
          action: '${selectedAction.type}',
          payload:  {
            ${stringifiedPayload.substring(1, stringifiedPayload.length - 1)}
            
          },
        });
          
      `;

    const getCodeBlock = async () => {
      const html = await codeToHtml(snippet, {
        theme: 'vitesse-dark',
        lang: 'ts',
        decorations: [
          {
            start: 21,
            end: 24,

            properties: { class: 'highlighted-word' },
          },
        ],
      });

      return html;
    };

    getCodeBlock().then(html => setCodeBlock(html));
  }, [selectedAction, selectedActionPlugin, payload]);

  return (
    <div className="px-8 h-full grid place-items-center max-w-full overflow-auto">
      <div
        dangerouslySetInnerHTML={{
          __html: codeBlock || '',
        }}
      />
    </div>
  );
}

export default ActionDetail;
