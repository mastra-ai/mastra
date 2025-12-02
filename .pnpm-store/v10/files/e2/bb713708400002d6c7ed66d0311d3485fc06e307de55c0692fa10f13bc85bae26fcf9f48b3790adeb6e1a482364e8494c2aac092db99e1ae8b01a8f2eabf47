import OptionList from './lib/section/option-list.js'
import ContentSection from './lib/section/content.js'
import arrayify from 'array-back'

/**
 * @module command-line-usage
 */

/**
 * Generates a usage guide suitable for a command-line app.
 * @param {Section|Section[]} - One or more section objects ({@link module:command-line-usage~content} or {@link module:command-line-usage~optionList}).
 * @returns {string}
 * @alias module:command-line-usage
 */
function commandLineUsage (sections) {
  sections = arrayify(sections)
  if (sections.length) {
    const output = sections.map(section => {
      if (section.optionList) {
        return new OptionList(section)
      } else {
        return new ContentSection(section)
      }
    })
    return '\n' + output.join('\n')
  } else {
    return ''
  }
}

export default commandLineUsage
