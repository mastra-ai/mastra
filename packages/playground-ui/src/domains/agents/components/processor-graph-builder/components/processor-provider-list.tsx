import { useState, useMemo } from 'react';
import { Droppable, Draggable } from '@hello-pangea/dnd';
import { createPortal } from 'react-dom';
import { ScrollArea } from '@/ds/components/ScrollArea';
import { Searchbar } from '@/ds/components/Searchbar';
import { Txt } from '@/ds/components/Txt';
import { useProcessorGraphBuilderContext } from './processor-graph-builder-context';
import { ProcessorProviderCard } from './processor-provider-card';

export function ProcessorProviderList() {
  const { providers, isLoadingProviders } = useProcessorGraphBuilderContext();
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search) return providers;
    const lower = search.toLowerCase();
    return providers.filter(p => p.name.toLowerCase().includes(lower) || p.description?.toLowerCase().includes(lower));
  }, [providers, search]);

  return (
    <div className="flex flex-col h-full border-l border-border1">
      <div className="p-3 border-b border-border1">
        <Txt as="h3" variant="ui-sm" className="font-medium text-neutral5 mb-2">
          Processors
        </Txt>
        <Searchbar onSearch={setSearch} label="Search processors" placeholder="Search..." />
      </div>
      <ScrollArea className="flex-1 min-h-0">
        <Droppable droppableId="provider-list" isDropDisabled type="PROVIDER">
          {provided => (
            <div ref={provided.innerRef} {...provided.droppableProps} className="flex flex-col gap-1 p-3">
              {isLoadingProviders && (
                <Txt variant="ui-sm" className="text-neutral3">
                  Loading...
                </Txt>
              )}
              {!isLoadingProviders && filtered.length === 0 && (
                <Txt variant="ui-sm" className="text-neutral3">
                  {search ? 'No processors match your search' : 'No processors available'}
                </Txt>
              )}
              {filtered.map((provider, index) => (
                <Draggable key={provider.id} draggableId={`provider-${provider.id}`} index={index}>
                  {(dragProvided, snapshot) => {
                    const card = (
                      <div
                        ref={dragProvided.innerRef}
                        {...dragProvided.draggableProps}
                        {...dragProvided.dragHandleProps}
                        style={dragProvided.draggableProps.style}
                      >
                        <ProcessorProviderCard provider={provider} isDragging={snapshot.isDragging} />
                      </div>
                    );

                    if (snapshot.isDragging) {
                      return createPortal(card, document.body);
                    }
                    return card;
                  }}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </ScrollArea>
    </div>
  );
}
