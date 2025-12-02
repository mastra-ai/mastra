import chalkTemplate from 'chalk-template'

function chalkFormat (str) {
  if (str) {
    str = str.replace(/`/g, '\\`')
    return chalkTemplate(Object.assign([], { raw: [str] }))
  } else {
    return ''
  }
}

export default chalkFormat
