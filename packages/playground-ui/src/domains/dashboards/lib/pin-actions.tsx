import { PinAction } from '../components/widget-controls';
import type { WidgetPin } from '../widget-kind';
import type { ViewHeading } from './chrome';

/**
 * Where a card's pin goes: with the actions shown on hover, or always once pinned, so a pinned card
 * reads as pinned at rest and can be unpinned without hover (on touch).
 */
export function pinActions(pin: WidgetPin | undefined): Pick<ViewHeading, 'actions' | 'persistentActions'> {
  if (!pin) return {};
  const button = <PinAction {...pin} />;
  return pin.isPinned ? { persistentActions: button } : { actions: button };
}
