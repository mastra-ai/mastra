export function installRenderProbe() {
  const previous = new Map();
  const buckets = {
    KnowledgeCanvas: 'canvas',
    KnowledgeNode: 'nodes',
    KnowledgeRecordNode: 'records',
    KnowledgeLink: 'links',
  };
  window.knowledgeRenders = { canvas: 0, nodes: 0, records: 0, links: 0 };
  window.profileKnowledgeRenders = true;
  window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
    supportsFiber: true,
    inject: () => 1,
    onCommitFiberUnmount: () => {},
    onCommitFiberRoot: (_id, root) => {
      if (!window.profileKnowledgeRenders) return;
      function visit(fiber) {
        if (typeof fiber.type === 'function') {
          const bucket = buckets[fiber.elementType?.displayName];
          if (bucket) {
            const key = `${bucket}:${fiber.memoizedProps?.id ?? 'canvas'}`;
            const last = previous.get(key);
            if (fiber.flags & 1 && (!last || last.props !== fiber.memoizedProps || last.state !== fiber.memoizedState))
              window.knowledgeRenders[bucket]++;
            previous.set(key, { props: fiber.memoizedProps, state: fiber.memoizedState });
          }
        }
        if (fiber.child) visit(fiber.child);
        if (fiber.sibling) visit(fiber.sibling);
      }
      visit(root.current);
    },
  };
}
