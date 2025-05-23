import { removeAllOptionsFromMastraExcept } from './remove-all-options-except';

export function removeAllOptionsExceptBundler(result: { hasCustomConfig: boolean }) {
  return removeAllOptionsFromMastraExcept(result, 'bundler');
}
