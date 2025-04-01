import { removeAllOptionsFromMastraExcept } from './remove-all-options-except';

export function removeAllOptionsExceptServer(result: { hasCustomConfig: boolean }) {
  return removeAllOptionsFromMastraExcept(result, 'server');
}
