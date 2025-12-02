import type View from './one.d.ts'

interface Two extends View {
  /** return any multi-word terms, like "didn't"  */
  contractions: (n?: number) => Contractions
  /** contract words that can combine, like "did not" */
  contract: () => View
  /** Average measure of tag confidence */
  confidence: () => number
  /** smart-replace root forms */
  swap: (fromLemma: string, toLemma: string, guardTag?: string) => View
}


interface Contractions extends View {
  /** turn "i've" into "i have" */
  expand: () => View
}

export default Two
