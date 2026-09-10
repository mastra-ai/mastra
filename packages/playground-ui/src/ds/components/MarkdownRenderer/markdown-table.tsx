import { CheckIcon, ChevronDownIcon, CopyIcon, DownloadIcon } from 'lucide-react';
import type { ComponentProps } from 'react';
import type { ExtraProps } from 'react-markdown';
import { downloadTableCsv } from './table-csv';
import { Button } from '@/ds/components/Button';
import { ButtonsGroup } from '@/ds/components/ButtonsGroup';
import { DropdownMenu } from '@/ds/components/DropdownMenu';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';

export function MarkdownTable({ node, children }: ComponentProps<'table'> & ExtraProps) {
  const markdown = node?.properties.tableMarkdown;
  const csv = node?.properties.tableCsv;
  const { isCopied, copyToClipboard } = useCopyToClipboard({ copyMessage: 'Copied table markdown' });

  return (
    <div className="my-3 w-fit max-w-full min-w-0">
      <div className="flex justify-end">
        <ButtonsGroup spacing="close" aria-label="Table actions">
          <Button
            type="button"
            size="xs"
            variant="ghost"
            disabled={typeof markdown !== 'string'}
            onClick={() => {
              if (typeof markdown === 'string') copyToClipboard(markdown);
            }}
            aria-label="Copy table as markdown"
          >
            {isCopied ? <CheckIcon /> : <CopyIcon />}
            {isCopied ? 'Copied!' : 'Copy table as markdown'}
          </Button>
          <DropdownMenu>
            <DropdownMenu.Trigger
              disabled={typeof csv !== 'string'}
              render={
                <Button type="button" size="icon-xs" variant="ghost" aria-label="More table options">
                  <ChevronDownIcon />
                </Button>
              }
            />
            <DropdownMenu.Content align="end" size="sm" className="w-max min-w-0">
              <DropdownMenu.Item
                size="sm"
                onClick={() => {
                  if (typeof csv === 'string') downloadTableCsv(csv);
                }}
              >
                <DownloadIcon />
                Download CSV
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu>
        </ButtonsGroup>
      </div>
      <div className="max-w-full overflow-x-auto">
        <table className="table min-w-full">{children}</table>
      </div>
    </div>
  );
}
