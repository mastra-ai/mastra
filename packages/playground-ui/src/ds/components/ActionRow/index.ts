import { ActionRowEnd, ActionRowRoot, ActionRowStart } from './action-row';

export const ActionRow = Object.assign(ActionRowRoot, {
  Start: ActionRowStart,
  End: ActionRowEnd,
});
