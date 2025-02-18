import { useContext, useState } from 'react';

import { Button } from '@/components/ui/button';

import { cn } from '@/lib/utils';

import { TraceContext } from './context/trace-context';
import type { SpanNode } from './types';
import { formatDuration } from './utils';

export function TreeNode({ node, depth = 0 }: { node: SpanNode; depth?: number }) {
  const [isExpanded, setIsExpanded] = useState(true);
  const hasChildren = node.children && node.children.length > 0;
  const { setOpenDetail, setSpan, openDetail, span } = useContext(TraceContext);

  const widthPercentage = Math.min(node.relativePercentage ? node?.relativePercentage : 0, 100);

  return (
    <div>
      <Button
        variant={'ghost'}
        className={cn('relative flex w-full items-center justify-start gap-2 py-3 pr-1 text-sm', {
          'text-accent-foreground bg-accent': span?.id === node.id,
        })}
        onClick={e => {
          e.preventDefault();
          e.stopPropagation();
          setSpan(node);
          if (openDetail && node.id !== span?.id) return;
          setOpenDetail(prev => !prev);
        }}
        style={{ paddingLeft: `${depth > 0 ? depth * 35 + 28 : 24}px` }}
      >
        {hasChildren ? (
          <div
            onClick={() => setIsExpanded(!isExpanded)}
            className="relative grid h-auto flex-shrink-0 place-items-center rounded-sm bg-[#1a1a1a] p-2"
          >
            <svg
              className={cn('!h-2 !w-2 transition-transform', isExpanded ? '' : '-rotate-90')}
              xmlns="http://www.w3.org/2000/svg"
              width="7"
              height="6"
              viewBox="0 0 7 6"
              fill="none"
            >
              <path
                d="M3.9338 5.5C3.74135 5.83333 3.26022 5.83333 3.06777 5.5L0.469694 0.999999C0.277244 0.666666 0.517814 0.25 0.902714 0.25L6.09886 0.25C6.48376 0.25 6.72433 0.666666 6.53188 1L3.9338 5.5Z"
                fill="#939393"
              />
            </svg>
          </div>
        ) : null}
        <div className="flex w-full gap-4 pr-4">
          <p
            className={cn('max-w-[400px] truncate px-1 text-sm', {
              'text-white': node?.status?.code === 0,
              'text-[#FF4500]': node?.status?.code !== 0,
            })}
          >
            {node.name}
          </p>

          {node.duration > 0 && (
            <div className="relative w-full max-w-[200px]">
              <div className="absolute top-[11px] h-px w-full bg-[hsl(220,14%,19%)]" />
              <div
                style={{
                  width: `${widthPercentage}%`,
                  left: 0,
                }}
                className={cn(
                  'absolute top-[9px] z-0 h-[5px] rounded-[5px] bg-white transition-all',
                  node.name.includes('agent') && 'left-1/2 bg-green-500',
                  node.name.includes('llm') && 'bg-[#5699A8]',
                  node.name.includes('ai') && 'left-2/4 w-5 bg-[#F09A56]',
                )}
              ></div>
              <span className="absolute left-0 top-3 text-[0.63rem] text-mastra-el-3">
                {formatDuration(node.duration)}ms
              </span>
            </div>
          )}
        </div>
      </Button>

      {hasChildren && isExpanded && (
        <>
          {node.children.map(child => (
            <TreeNode key={child.id} node={child} depth={depth + 1} />
          ))}
        </>
      )}
    </div>
  );
}
