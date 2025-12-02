import type { DraggableId } from '../../types';

export type Unregister = () => void;

export type Register = (id: DraggableId, focus: () => void) => Unregister;

export interface FocusMarshal {
  register: Register;
  tryRecordFocus: (tryRecordFor: DraggableId) => void;
  tryRestoreFocusRecorded: () => void;
  tryShiftRecord: (previous: DraggableId, redirectTo: DraggableId) => void;
}
