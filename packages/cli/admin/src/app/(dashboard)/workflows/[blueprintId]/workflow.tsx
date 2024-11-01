'use client';

import type { BlueprintWithRelations } from '@mastra/core';
import type { WorkflowContextBlueprintInfo } from '@mastra/core';
import { useEffect, useRef } from 'react';

import { useRouter } from 'next/navigation';

import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

import { useBackgroundCanvasScroll } from '@/lib/hooks/use-background-canvas-scroll';
import { useUpdateMetaTags } from '@/lib/hooks/use-update-meta-tags';

import { WorkflowGraph } from '@/domains/workflows/components/workflow-graph/workflow-graph';
import { WorkflowLoader } from '@/domains/workflows/components/workflow-loader/workflow-loader';
import { WorkflowSidebar } from '@/domains/workflows/components/workflow-sidebar/workflow-sidebar';
import { useWorkflowContext } from '@/domains/workflows/context/workflow-context';
import { useGetWorkflow } from '@/domains/workflows/hooks/use-workflow';
import { constructWorkflowContextBluePrint } from '@/domains/workflows/utils';

export function Workflow({ blueprintId }: { blueprintId: string }) {
  const { setActions, setBlueprintInfo, setAttempedPublish, setSelectedBlock, constructedBlueprint, setTrigger } =
    useWorkflowContext();
  const router = useRouter();

  const { workflow, localBlueprint, isLoading } = useGetWorkflow({ blueprintId });

  const containerRef = useRef<HTMLDivElement>(null);

  const { handleMouseDown, handleMouseUp } = useBackgroundCanvasScroll({
    containerRef,
    includeVerticalScroll: true,
  });

  const isCurrentBlueprint = blueprintId === workflow?.id;

  useUpdateMetaTags({
    title: workflow?.title ?? ``,
  });

  useEffect(() => {
    if (localBlueprint && isCurrentBlueprint) {
      const { blueprintInfo, trigger, actions } = constructWorkflowContextBluePrint(
        localBlueprint as BlueprintWithRelations,
      );
      setActions(actions);
      setTrigger(trigger || { id: '', type: '' });
      setBlueprintInfo(blueprintInfo);
    }

    return () => {
      setActions({});
      setTrigger({});
      setSelectedBlock(undefined);
      setBlueprintInfo({} as WorkflowContextBlueprintInfo);
      setAttempedPublish(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCurrentBlueprint]);

  if (isLoading) {
    return <WorkflowLoader />;
  }

  if (!workflow) {
    router.replace(`/workflows`);
    return null;
  }

  return (
    <section className="flex h-full w-full overflow-hidden">
      <ScrollArea
        innerRef={containerRef}
        className="grow bg-[url(/images/workflow-bg.svg)]"
        viewportClassName="mastra-workflows-scroll-area scroll-mb-6"
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
      >
        <WorkflowGraph blueprint={constructedBlueprint} />

        <ScrollBar orientation="horizontal" />
      </ScrollArea>
      <aside className="border-mastra-border-1 bg-mastra-bg-2 m-2 w-[24rem] shrink-0 rounded-[0.3125rem] border-[0.5px]">
        <WorkflowSidebar />
      </aside>
    </section>
  );
}
