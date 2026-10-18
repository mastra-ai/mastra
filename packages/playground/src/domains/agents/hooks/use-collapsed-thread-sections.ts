import { useLocalStorageState } from '@mastra/playground-ui/hooks/use-local-storage-state';
import { z } from 'zod/v4';

export type ThreadSection = 'pinned' | 'recent';

const collapsedSchema = z.array(z.enum(['pinned', 'recent']));

export const useCollapsedThreadSections = () => {
  const [collapsed, setCollapsed] = useLocalStorageState<ThreadSection[]>({
    initialKey: 'mastra:thread-sections-collapsed',
    schema: collapsedSchema,
    defaultValue: [],
  });

  const isCollapsed = (section: ThreadSection) => collapsed.includes(section);
  const toggle = (section: ThreadSection) =>
    setCollapsed(sections =>
      sections.includes(section) ? sections.filter(s => s !== section) : [...sections, section],
    );

  return { isCollapsed, toggle };
};
