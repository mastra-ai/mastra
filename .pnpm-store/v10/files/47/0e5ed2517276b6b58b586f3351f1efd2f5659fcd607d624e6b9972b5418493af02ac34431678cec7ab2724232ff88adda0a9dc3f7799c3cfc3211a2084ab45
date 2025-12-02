const isRange = /^([0-9.]{1,4}[a-z]{0,2}) ?[-–—] ?([0-9]{1,4}[a-z]{0,2})$/i
const timeRange = /^([0-9]{1,2}(:[0-9][0-9])?(am|pm)?) ?[-–—] ?([0-9]{1,2}(:[0-9][0-9])?(am|pm)?)$/i
const phoneNum = /^[0-9]{3}-[0-9]{4}$/

const numberRange = function (terms, i) {
  let term = terms[i]
  let parts = term.text.match(isRange)
  if (parts !== null) {
    // 123-1234 is a phone number, not a number-range
    if (term.tags.has('PhoneNumber') === true || phoneNum.test(term.text)) {
      return null
    }
    return [parts[1], 'to', parts[2]]
  } else {
    parts = term.text.match(timeRange)
    if (parts !== null) {
      return [parts[1], 'to', parts[4]]
    }
  }
  return null
}
export default numberRange
