import { useIsMobile } from '@/hooks/use-is-mobile';

/** Whether the canvas has a phone's layout: the flow in one column and the side panel in a bottom sheet. */
export function usePhoneLayout() {
  return useIsMobile(640);
}
