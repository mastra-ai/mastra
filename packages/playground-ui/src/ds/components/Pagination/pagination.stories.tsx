import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from './pagination';
import { getPaginationRange } from './pagination-range';

const meta: Meta<typeof Pagination> = {
  title: 'Navigation/Pagination',
  component: Pagination,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Page navigation built from parts: Previous, page numbers, ellipses, and Next. The current page wears a raised pill. The caller owns the page. Import from `@mastra/playground-ui/components/Pagination`.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Pagination>;

function NumberedPagination({ pageCount, initialPage = 0 }: { pageCount: number; initialPage?: number }) {
  const [page, setPage] = useState(initialPage);
  return (
    <Pagination>
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious disabled={page <= 0} onClick={() => setPage(page - 1)} />
        </PaginationItem>
        {getPaginationRange(page, pageCount).map(item => {
          if (item.kind === 'ellipsis') {
            return (
              <PaginationItem key={item.key}>
                <PaginationEllipsis />
              </PaginationItem>
            );
          }
          return (
            <PaginationItem key={item.page}>
              <PaginationLink
                aria-label={`Page ${item.page + 1}`}
                isActive={item.page === page}
                onClick={() => setPage(item.page)}
              >
                {item.page + 1}
              </PaginationLink>
            </PaginationItem>
          );
        })}
        <PaginationItem>
          <PaginationNext disabled={page >= pageCount - 1} onClick={() => setPage(page + 1)} />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}

export const Default: Story = {
  parameters: {
    docs: { description: { story: 'Seven or fewer pages show every page number.' } },
  },
  render: () => <NumberedPagination pageCount={5} />,
};

export const ManyPages: Story = {
  parameters: {
    docs: {
      description: {
        story:
          '`getPaginationRange` keeps the first and last pages and collapses distant pages into ellipses around the current one.',
      },
    },
  },
  render: () => <NumberedPagination pageCount={24} initialPage={9} />,
};

export const Links: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Pass `render={<a href="…" />}`, or a router link, when each page has its own URL. Cmd-click opens the page in a new tab.',
      },
    },
  },
  render: () => (
    <Pagination>
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious render={<a href="#page-1" />} />
        </PaginationItem>
        <PaginationItem>
          <PaginationLink render={<a href="#page-1" />}>1</PaginationLink>
        </PaginationItem>
        <PaginationItem>
          <PaginationLink isActive render={<a href="#page-2" />}>
            2
          </PaginationLink>
        </PaginationItem>
        <PaginationItem>
          <PaginationLink render={<a href="#page-3" />}>3</PaginationLink>
        </PaginationItem>
        <PaginationItem>
          <PaginationNext render={<a href="#page-3" />} />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  ),
};

export const PreviousAndNext: Story = {
  parameters: {
    docs: {
      description: {
        story: 'For cursor-based APIs without a total, render only Previous and Next.',
      },
    },
  },
  render: function PreviousAndNextStory() {
    const [page, setPage] = useState(0);
    return (
      <Pagination>
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious disabled={page <= 0} onClick={() => setPage(page - 1)} />
          </PaginationItem>
          <PaginationItem>
            <PaginationNext onClick={() => setPage(page + 1)} />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    );
  },
};
