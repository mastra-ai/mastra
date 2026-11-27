import fs from 'fs/promises'
import path from 'path'
import { ACCEPT_FILE, RULE_FILE, renderHeadingVocabulary } from '../../vale/heading-vocabulary.mjs'
import { finding } from '../finding'
import type { Check, CheckResult } from '../types'

const RULE_ID = 'mastra/heading-vocabulary-drift'

/** Keeps the accept.txt copy in Mastra.HeadingSentenceCase in sync. Runs without Vale, so `--no-vale` still checks it. */
export const headingVocabularyCheck: Check = {
  name: 'heading-vocabulary',
  categories: ['prose'],
  scope: 'repo',
  async run(ctx): Promise<CheckResult> {
    const result: CheckResult = { findings: [], fixed: 0 }
    const rulePath = path.join(ctx.rootDir, RULE_FILE)
    const [ruleYaml, acceptTxt] = await Promise.all([
      fs.readFile(rulePath, 'utf-8'),
      fs.readFile(path.join(ctx.rootDir, ACCEPT_FILE), 'utf-8'),
    ])
    const expected = renderHeadingVocabulary(ruleYaml, acceptTxt)
    if (expected === ruleYaml) return result
    if (ctx.fix && ctx.isRuleActive(RULE_ID)) {
      await fs.writeFile(rulePath, expected)
      result.fixed = 1
    } else {
      result.findings.push(
        finding(RULE_ID, `The accept.txt terms in ${RULE_FILE} are out of date with ${ACCEPT_FILE}`, {
          file: RULE_FILE,
        }),
      )
    }
    return result
  },
}
