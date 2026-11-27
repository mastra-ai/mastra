import { GrowIn } from '../canvas-frame';
import { Notice } from '@/ds/components/Notice';

/** How the saved order compares with the old route list, whether that list still files cards, and unsaved changes. */
export function IntakeOrderStatus({
  order,
  changed,
}: {
  order: {
    origin: string;
    evaluator: string;
    comparison: { compared: number; differing: number; notRouted: number };
  };
  changed: boolean;
}) {
  const { compared, differing, notRouted } = order.comparison;
  const lines: string[] = [];
  if (order.origin === 'derived') lines.push('Worked out from the old route list until someone saves an order.');
  if (compared > 0) {
    const lost = notRouted > 0 ? `, ${notRouted} of them Not routed` : '';
    lines.push(
      differing === 0
        ? `The last ${compared} cards land on the same boards as with the old route list.`
        : `Of the last ${compared} cards, ${differing} would land on another board than with the old route list${lost}.`,
    );
  }
  if (order.evaluator === 'route-list') lines.push('Intake still files cards by the old route list.');
  if (changed) lines.push('Not saved yet. The comparison is for the saved order.');
  if (lines.length === 0) return null;
  // Pulled up by the column's gap and spaced back inside, so a notice that shows up mid-page eases the boards down.
  return (
    <GrowIn className="-mt-3">
      <Notice variant="info" className="mt-3">
        <span className="flex flex-col gap-1">
          {lines.map(line => (
            <span key={line}>{line}</span>
          ))}
        </span>
      </Notice>
    </GrowIn>
  );
}
