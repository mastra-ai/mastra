import type { ComponentProps } from 'react';
import type { ExtraProps } from 'react-markdown';
import { downloadTableCsv } from './table-csv';
import { Button } from '@/ds/components/Button';
import { ButtonsGroup } from '@/ds/components/ButtonsGroup';
import { CopyButton } from '@/ds/components/CopyButton';
import { DropdownMenu } from '@/ds/components/DropdownMenu';
import { IconArrowInbox } from '@/ds/icons/central/IconArrowInbox';
import { IconChevronDownMedium } from '@/ds/icons/central/IconChevronDownMedium';

export function MarkdownTable({ node, children }: ComponentProps<'table'> & ExtraProps) {
  const markdown = node?.properties.tableMarkdown;
  const csv = node?.properties.tableCsv;

  return (
    <div className="my-3 w-fit max-w-full min-w-0">
      <div className="flex justify-end">
        <ButtonsGroup size="sm" aria-label="Table actions">
          <CopyButton
            content={typeof markdown === 'string' ? markdown : ''}
            variant="ghost"
            disabled={typeof markdown !== 'string'}
          >
            Copy table as markdown
          </CopyButton>
          <DropdownMenu>
            <DropdownMenu.Trigger
              disabled={typeof csv !== 'string'}
              render={
                <Button type="button" size="icon-sm" variant="ghost" aria-label="More table options">
                  <IconChevronDownMedium />
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
