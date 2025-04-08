import { removeAllOptionsFromMastraExcept } from './remove-all-options-except';

export function removeAllOptionsExceptTelemetry(result: { hasCustomConfig: boolean }) {
  return removeAllOptionsFromMastraExcept(result, 'telemetry');
}
