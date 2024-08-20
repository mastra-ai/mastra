'use client';

import { useEffect, useState } from 'react';

import IconButton from '@/components/ui/icon-button';

import { useCopyToClipboard } from '@/lib/hooks/useCopyToClipboard';

import { Icon } from '@/app/components/icon';

import { codeToHtml } from 'shiki/bundle/web';

import { useActionPlaygroundContext } from '../providers/action-playground-provider';

function ActionDetail() {
  const { selectedAction, payload } = useActionPlaygroundContext();
  const selectedActionPlugin = selectedAction?.integrationName;
  const [codeBlock, setCodeBlock] = useState<string | null>(null);
  const [_, CopyFn, isCodeBlockCopied] = useCopyToClipboard();
  const [snippet, setSnippet] = useState<string>('');

  useEffect(() => {
    if (!selectedAction || !selectedActionPlugin) {
      return;
    }

    const stringifiedPayload = JSON.stringify(payload, null, 10);

    const snippet = `
        'use server';


         
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
      });

      return html;
    };

    setSnippet(snippet);
    getCodeBlock().then(html => setCodeBlock(html));
  }, [selectedAction, selectedActionPlugin, payload]);

  return selectedAction ? (
    <div className="px-8 h-full grid place-items-center max-w-full overflow-auto">
      <div className="w-full h-max relative group">
        <IconButton
          onClick={() => CopyFn(snippet)}
          variant={'secondary'}
          className="absolute top-4 right-4 w-8 h-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150 ease-in-out"
        >
          {isCodeBlockCopied ? (
            <Icon name="check" className="text-white" />
          ) : (
            <Icon name="clipboard" className="text-white" />
          )}
        </IconButton>
        <div
          dangerouslySetInnerHTML={{
            __html: codeBlock || '',
          }}
        />
      </div>
    </div>
  ) : (
    <></>
  );
}

export default ActionDetail;
