import type { ComponentProps } from 'react';
import type { ExtraProps } from 'react-markdown';
import { downloadTableCsv } from './table-csv';
import { Button } from '@/ds/components/Button';
import { ButtonsGroup } from '@/ds/components/ButtonsGroup';
import { DropdownMenu } from '@/ds/components/DropdownMenu';
import { IconArrowInbox } from '@/ds/icons/central/IconArrowInbox';
import { IconCheckmark1 } from '@/ds/icons/central/IconCheckmark1';
import { IconChevronBottom } from '@/ds/icons/central/IconChevronBottom';
import { IconSquareBehindSquare1 } from '@/ds/icons/central/IconSquareBehindSquare1';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';

export function MarkdownTable({ node, children }: ComponentProps<'table'> & ExtraProps) {
  const markdown = node?.properties.tableMarkdown;
  const csv = node?.properties.tableCsv;
  const { isCopied, copyToClipboard } = useCopyToClipboard({ copyMessage: 'Copied table markdown' });

  return (
    <div className="my-3 w-fit max-w-full min-w-0">
      <div className="flex justify-end">
        <ButtonsGroup size="sm" aria-label="Table actions">
          <Button
            type="button"
            variant="ghost"
            disabled={typeof markdown !== 'string'}
            onClick={() => {
              if (typeof markdown === 'string') copyToClipboard(markdown);
            }}
            aria-label="Copy table as markdown"
          >
            {isCopied ? <IconCheckmark1 /> : <IconSquareBehindSquare1 />}
            {isCopied ? 'Copied!' : 'Copy table as markdown'}
          </Button>
          <DropdownMenu>
            <DropdownMenu.Trigger
              disabled={typeof csv !== 'string'}
              render={
                <Button type="button" size="icon-sm" variant="ghost" aria-label="More table options">
                  <IconChevronBottom />
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
                <IconArrowInbox />
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
