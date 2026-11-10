import { getRule } from './rules'
import type { Finding, Severity } from './types'

export function finding(
  ruleId: string,
  message: string,
  location: { file?: string; line?: number; column?: number } = {},
  extra: { suggestion?: string; severity?: Severity; fixable?: boolean } = {},
): Finding {
  const rule = getRule(ruleId)
  const result: Finding = {
    ruleId,
    severity: extra.severity ?? rule.severity,
    category: rule.category,
    message,
    fixable: extra.fixable ?? rule.fixable,
  }
  if (location.file !== undefined) result.file = location.file
  if (location.line !== undefined) result.line = location.line
  if (location.column !== undefined) result.column = location.column
  if (extra.suggestion !== undefined) result.suggestion = extra.suggestion
  return result
}
