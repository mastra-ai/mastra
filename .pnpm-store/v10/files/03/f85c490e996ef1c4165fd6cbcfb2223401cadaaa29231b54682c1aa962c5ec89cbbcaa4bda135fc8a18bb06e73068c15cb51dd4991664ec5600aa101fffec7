import arrayify from 'array-back'
import chalk from './chalk-format.js'
import os from 'os'

class Section {
  constructor () {
    this.lines = []
  }

  add (lines) {
    if (lines) {
      arrayify(lines).forEach(line => this.lines.push(line))
    } else {
      this.lines.push('')
    }
  }

  toString () {
    return this.lines.join(os.EOL)
  }

  header (text) {
    if (text) {
      this.add(chalk(`{bold ${text}}`))
      this.add()
    }
  }
}

export default Section
