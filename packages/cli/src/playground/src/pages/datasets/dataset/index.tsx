import { AgentIcon, Breadcrumb, Crumb, Header, MainContentLayout, WorkflowIcon } from '@mastra/playground-ui';
import { useParams, Link } from 'react-router';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowDownIcon, ArrowLeftIcon, ArrowRightIcon, ArrowUpIcon, EditIcon, Trash2Icon, XIcon } from 'lucide-react';
import { format, formatDate, isToday } from 'date-fns';
import { Fragment, useState } from 'react';
import { cn } from '@/lib/utils';
import type { ScoreRowData } from '@mastra/core/eval';

import * as Dialog from '@radix-ui/react-dialog';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

export default function Dataset() {
  const { datasetId } = useParams()! as { datasetId: string };
  const { dataset, isLoading } = {
    dataset: {
      id: datasetId,
      name: 'Sample Dataset',
      description: 'This is a sample dataset description.',
    },
    isLoading: false,
  }; // useDataset(datasetId!);

  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [detailsIsOpened, setDetailsIsOpened] = useState<boolean>(false);

  const dataRows = Array.from({ length: 5 }, (_, i) => ({
    id: `id-${i + 1}`,
    input: `This is a sample input text ${i + 1}`,
    output: `This is a sample dataset output ${i + 1}`,
    createdAt: new Date(),
    updatedAt: new Date(),
  }));

  const handleOnListItemClick = (score: any) => {
    if (score.id === selectedItem?.id) {
      setSelectedItem(null);
    } else {
      setSelectedItem(score);
      setDetailsIsOpened(true);
    }
  };
  const toPreviousItem = (currentScore: ScoreRowData) => {
    const currentIndex = dataRows?.findIndex(score => score?.id === currentScore?.id);
    if (currentIndex === -1 || currentIndex === (dataRows?.length || 0) - 1) {
      return null; // No next score
    }
    return () => setSelectedItem(dataRows[(currentIndex || 0) + 1]);
  };
  const toNextItem = (currentScore: ScoreRowData) => {
    const currentIndex = dataRows?.findIndex(score => score?.id === currentScore?.id);
    if ((currentIndex || 0) <= 0) {
      return null; // No previous score
    }
    return () => setSelectedItem(dataRows[(currentIndex || 0) - 1]);
  };
  // if (isLoading) {
  //   return null;
  // }

  const columnNames = ['Input', 'Output', 'Updated at'];
  const columnSizes = '2fr_3fr_9rem';

  return (
    <MainContentLayout>
      <Header>
        <Breadcrumb>
          <Crumb as={Link} to={`/datasets`}>
            Datasets
          </Crumb>
          <Crumb as={Link} to={`/datasets/${datasetId}`} isCurrent>
            {isLoading ? <Skeleton className="w-20 h-4" /> : dataset.name || 'Not found'}
          </Crumb>
        </Breadcrumb>
      </Header>
      {dataset ? (
        <>
          <div className={cn(`h-full overflow-y-scroll `)}>
            <div className={cn('max-w-[100rem] px-[3rem] mx-auto')}>
              <PageHeader title={dataset.name} description={dataset.description} />
              <ListHeader columnNames={columnNames} columnSizes={columnSizes} />
              <List
                items={dataRows || []}
                selectedItem={selectedItem}
                onItemClick={handleOnListItemClick}
                columnSizes={`2fr_3fr_9rem`}
                columnNames={columnNames}
                //  isLoading={scoresLoading}
                //  total={scoresTotal}
                //  page={scoresPage}
                //  perPage={scoresPerPage}
                //  hasMore={scoresHasMore}
                //  onNextPage={handleNextPage}
                //  onPrevPage={handlePrevPage}
              />
            </div>
          </div>
          <ItemDetails
            item={selectedItem}
            isOpen={detailsIsOpened}
            onClose={() => setDetailsIsOpened(false)}
            onNext={toNextItem(selectedItem)}
            onPrevious={toPreviousItem(selectedItem)}
          >
            <div>
              <div className="grid gap-[1rem] [&>label]:text-icon4 [&>label]:text-[0.875rem]">
                <Label>Input</Label>
                <Textarea
                  className="disabled:opacity-80"
                  placeholder="Enter your prompt here..."
                  value={selectedItem?.input || ''}
                  rows={5}
                  disabled
                />
              </div>
              <div className="grid gap-[1rem] [&>label]:text-icon4 [&>label]:text-[0.875rem]">
                <Label>Output</Label>
                <Textarea
                  className="disabled:opacity-80"
                  placeholder="Enter your prompt here..."
                  value={selectedItem?.output || ''}
                  rows={5}
                  disabled
                />
              </div>
            </div>

            <div
              className={cn(
                'border-t border-border1 mt-auto pt-[2rem] flex items-center justify-end gap-[1rem]',
                '[&_svg]:w-[1.1em] [&_svg]:h-[1.1em] [&_svg]:text-icon4',
              )}
            >
              <span className="text-icon4 text-[0.75rem]">
                Updated at{' '}
                {selectedItem?.updatedAt
                  ? formatDate(new Date(selectedItem.updatedAt), 'LLL do yyyy, hh:mm bb')
                  : 'n/a'}
              </span>
              <Button
                variant="outline"
                onClick={() => {
                  setDetailsIsOpened(false);
                  setSelectedItem(null);
                }}
              >
                Edit <EditIcon />
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setDetailsIsOpened(false);
                  setSelectedItem(null);
                }}
              >
                Delete <Trash2Icon />
              </Button>
            </div>
          </ItemDetails>
        </>
      ) : null}
    </MainContentLayout>
  );
}

function PageHeader({ title, description }: { title: string; description: string }) {
  return (
    <div
      className={cn(
        'grid z-[1] top-0 gap-y-[0.5rem] text-icon4 bg-surface2 py-[3rem]',
        '3xl:h-full 3xl:content-start 3xl:grid-rows-[auto_1fr] h-full 3xl:overflow-y-auto',
      )}
    >
      <div className="grid gap-[1rem] w">
        <h1 className="text-icon6 text-[1.25rem]">{title}</h1>
        <p className="m-0 text-[0.875rem]">{description}</p>
      </div>
    </div>
  );
}

type ListHeaderProps = {
  columnNames: string[];
  columnSizes?: string;
};

function ListHeader({ columnNames = [], columnSizes }: ListHeaderProps) {
  const columnsStyle = columnSizes || columnNames.map(() => '1fr').join('_');

  return (
    <div className={cn('sticky top-0 bg-surface4 z-[1] mt-[1rem] mb-[1rem] rounded-lg px-[1.5rem]')}>
      <div
        className={cn(
          'grid gap-[1rem] text-left text-[0.75rem] text-icon3 uppercase py-[1rem]',
          `grid-cols-[${columnsStyle}]`,
        )}
      >
        {columnNames.map(name => (
          <span key={name} className="text-icon3 font-semibold">
            {name}
          </span>
        ))}
      </div>
    </div>
  );
}

function List({
  items,
  selectedItem,
  onItemClick,
  isLoading,
  total,
  page,
  hasMore,
  onNextPage,
  onPrevPage,
  perPage,
  columnSizes,
  columnNames,
}: {
  items: any[];
  selectedItem: any;
  onItemClick?: (item: any) => void;
  isLoading?: boolean;
  total?: number;
  page?: number;
  hasMore?: boolean;
  onNextPage?: () => void;
  onPrevPage?: () => void;
  perPage?: number;
  columnSizes?: string;
  columnNames: string[];
}) {
  const columnsStyle = columnSizes || columnNames.map(() => '1fr').join('_');

  if (isLoading) {
    return (
      <div className="flex border border-border1 w-full h-[3.5rem] items-center justify-center text-[0.875rem] text-icon3 rounded-lg">
        Loading...
      </div>
    );
  }

  return (
    <div className="grid gap-[2rem] mb-[3rem]">
      <ul className="grid border border-border1f bg-surface3 rounded-xl ">
        {items?.length === 0 && (
          <li className="text-icon3 text-[0.875rem] text-center h-[3.5rem] items-center flex justify-center">
            No scores found for this scorer.
          </li>
        )}
        {items?.length > 0 &&
          items.map(item => {
            const itemDateStr = item?.updatedAt || item?.createdAt;
            const itemDate = itemDateStr ? new Date(itemDateStr) : null;
            const itemDateFormatted = itemDate ? format(itemDate, 'MMM d HH:mm aa') : 'n/a';

            return (
              <ListItem
                key={item.id}
                item={item}
                selectedItem={selectedItem}
                onClick={onItemClick}
                columnsStyle={columnsStyle}
              >
                <ListItemCell>{item.input}</ListItemCell>
                <ListItemCell>{item.output}</ListItemCell>
                <ListItemCell>{itemDateFormatted}</ListItemCell>
              </ListItem>
            );
          })}
      </ul>

      {typeof page === 'number' && typeof perPage === 'number' && typeof total === 'number' && (
        <div className={cn('flex items-center justify-center text-icon3 text-[0.875rem] gap-[2rem]')}>
          <span>Page {page ? page + 1 : '1'}</span>
          <div
            className={cn(
              'flex gap-[1rem]',
              '[&>button]:flex [&>button]:items-center [&>button]:gap-[0.5rem] [&>button]:text-icon4 [&>button:hover]:text-icon5 [&>button]:transition-colors [&>button]:border [&>button]:border-border1 [&>button]:p-[0.25rem] [&>button]:px-[0.5rem] [&>button]:rounded-md',
              ' [&_svg]:w-[1em] [&_svg]:h-[1em] [&_svg]:text-icon3',
            )}
          >
            {typeof page === 'number' && page > 0 && (
              <button onClick={onPrevPage} disabled={page === 0}>
                <ArrowLeftIcon />
                Previous
              </button>
            )}
            {hasMore && (
              <button onClick={onNextPage} disabled={!hasMore}>
                Next
                <ArrowRightIcon />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ListItem({
  item,
  selectedItem,
  onClick,
  children,
  columnsStyle,
}: {
  item: any;
  selectedItem: any | null;
  onClick?: (score: any) => void;
  children?: React.ReactNode;
  columnsStyle?: string;
}) {
  const isSelected = selectedItem?.id === item.id;

  const handleClick = () => {
    return onClick && onClick(item);
  };

  // const isTodayDate = isToday(new Date(item.createdAt));
  // const dateStr = format(new Date(item.createdAt), 'MMM d yyyy');
  // const timeStr = format(new Date(item.createdAt), 'h:mm:ss bb');
  // const inputPrev = item?.input || '';
  // const outputPrev = item?.output || '';

  return (
    <li
      className={cn('scorerListItem border-b text-[#ccc] border-border1 last:border-b-0 text-[0.875rem]', {
        'bg-surface5': isSelected,
      })}
    >
      <button
        onClick={handleClick}
        className={cn(
          'grid w-full px-[1.5rem] gap-[1rem] text-left items-center min-h-[3.5rem]',
          `grid-cols-[${columnsStyle}]`,
        )}
      >
        {children}
      </button>
    </li>
  );
}

function ListItemCell({ children }: { children: React.ReactNode }) {
  return <span className="text-icon4 text-[0.875rem] truncated">{children}</span>;
}

function ItemDetails({
  isOpen,
  item,
  onClose,
  onPrevious,
  onNext,
  children,
}: {
  isOpen: boolean;
  item: any;
  onClose?: () => void;
  onNext?: (() => void) | null;
  onPrevious?: (() => void) | null;
  children?: React.ReactNode;
}) {
  if (!item) {
    return null;
  }

  const handleOnNext = () => {
    if (onNext) {
      onNext();
    }
  };

  const handleOnPrevious = () => {
    if (onPrevious) {
      onPrevious();
    }
  };

  const prompts: Record<
    string,
    {
      prompt: string;
      description: string;
    }
  > = {};

  return (
    <Dialog.Root open={isOpen} onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="bg-black top-0 bottom-0 right-0 left-0 fixed z-[10] opacity-[0.1]" />
        <Dialog.Content
          className={cn(
            'fixed top-0 bottom-0 right-0 border-l border-border1 w-[70rem] max-w-[calc(100vw-15rem)] z-[100] bg-surface4 px-[1rem] overflow-y-scroll',
          )}
        >
          <div className="grid h-full grid-rows-[auto_1fr_auto]">
            <div className="bg-surface4 border-b-2 border-border1 flex items-center py-[1.5rem] px-[1rem]">
              <h2 className=" w-full text-[0.875rem] !text-icon5 !font-normal flex items-center gap-[1rem]">
                <span>{item.id}</span>|<span>{format(new Date(item.createdAt), 'LLL do yyyy, hh:mm:ss bb')}</span>
              </h2>
              <div className="flex gap-[1rem]">
                <Button variant={'outline'} onClick={handleOnNext} disabled={!onNext}>
                  Next
                  <ArrowUpIcon />
                </Button>
                <Button variant={'outline'} onClick={handleOnPrevious} disabled={!onPrevious}>
                  Previous
                  <ArrowDownIcon />
                </Button>
                <Dialog.Close asChild>
                  <button
                    className="inline-flex bg-surface5 appearance-none items-center justify-center rounded-md p-[.2rem] focus:shadow-[0_0_0_2px] focus:outline-none"
                    aria-label="Close"
                  >
                    <XIcon />
                  </button>
                </Dialog.Close>
              </div>
            </div>

            <div className="grid p-[2rem]">{children}</div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
