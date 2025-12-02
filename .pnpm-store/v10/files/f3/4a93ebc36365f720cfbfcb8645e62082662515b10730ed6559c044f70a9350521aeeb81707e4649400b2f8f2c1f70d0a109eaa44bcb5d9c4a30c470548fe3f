const hasMinMax = /\{([0-9]+)?(, *[0-9]*)?\}/
const andSign = /&&/
// const hasDash = /\p{Letter}[-–—]\p{Letter}/u
const captureName = new RegExp(/^<\s*(\S+)\s*>/)
/* break-down a match expression into this:
{
  word:'',
  tag:'',
  regex:'',

  start:false,
  end:false,
  negative:false,
  anything:false,
  greedy:false,
  optional:false,

  named:'',
  choices:[],
}
*/
const titleCase = str => str.charAt(0).toUpperCase() + str.substring(1)
const end = (str) => str.charAt(str.length - 1)
const start = (str) => str.charAt(0)
const stripStart = (str) => str.substring(1)
const stripEnd = (str) => str.substring(0, str.length - 1)

const stripBoth = function (str) {
  str = stripStart(str)
  str = stripEnd(str)
  return str
}
//
const parseToken = function (w, opts) {
  let obj = {}
  //collect any flags (do it twice)
  for (let i = 0; i < 2; i += 1) {
    //end-flag
    if (end(w) === '$') {
      obj.end = true
      w = stripEnd(w)
    }
    //front-flag
    if (start(w) === '^') {
      obj.start = true
      w = stripStart(w)
    }
    if (end(w) === '?') {
      obj.optional = true
      w = stripEnd(w)
    }
    //capture group (this one can span multiple-terms)
    if (start(w) === '[' || end(w) === ']') {
      obj.group = null
      if (start(w) === '[') {
        obj.groupStart = true
      }
      if (end(w) === ']') {
        obj.groupEnd = true
      }
      w = w.replace(/^\[/, '')
      w = w.replace(/\]$/, '')
      // Use capture group name
      if (start(w) === '<') {
        const res = captureName.exec(w)
        if (res.length >= 2) {
          obj.group = res[1]
          w = w.replace(res[0], '')
        }
      }
    }
    //back-flags
    if (end(w) === '+') {
      obj.greedy = true
      w = stripEnd(w)
    }
    if (w !== '*' && end(w) === '*' && w !== '\\*') {
      obj.greedy = true
      w = stripEnd(w)
    }
    if (start(w) === '!') {
      obj.negative = true
      // obj.optional = true
      w = stripStart(w)
    }
    //soft-match
    if (start(w) === '~' && end(w) === '~' && w.length > 2) {
      w = stripBoth(w)
      obj.fuzzy = true
      obj.min = opts.fuzzy || 0.85
      if (/\(/.test(w) === false) {
        obj.word = w
        return obj
      }
    }

    //regex
    if (start(w) === '/' && end(w) === '/') {
      w = stripBoth(w)
      if (opts.caseSensitive) {
        obj.use = 'text'
      }
      obj.regex = new RegExp(w) //potential vuln - security/detect-non-literal-regexp
      return obj
    }

    // support foo{1,9}
    if (hasMinMax.test(w) === true) {
      w = w.replace(hasMinMax, (_a, b, c) => {
        if (c === undefined) {
          // '{3}'	Exactly three times
          obj.min = Number(b)
          obj.max = Number(b)
        } else {
          c = c.replace(/, */, '')
          if (b === undefined) {
            // '{,9}' implied zero min
            obj.min = 0
            obj.max = Number(c)
          } else {
            // '{2,4}' Two to four times
            obj.min = Number(b)
            // '{3,}' Three or more times
            obj.max = Number(c || 999)
          }
        }
        // use same method as '+'
        obj.greedy = true
        // 0 as min means the same as '?'
        if (!obj.min) {
          obj.optional = true
        }
        return ''
      })
    }

    //wrapped-flags
    if (start(w) === '(' && end(w) === ')') {
      // support (one && two)
      if (andSign.test(w)) {
        obj.choices = w.split(andSign)
        obj.operator = 'and'
      } else {
        obj.choices = w.split('|')
        obj.operator = 'or'
      }
      //remove '(' and ')'
      obj.choices[0] = stripStart(obj.choices[0])
      let last = obj.choices.length - 1
      obj.choices[last] = stripEnd(obj.choices[last])
      // clean up the results
      obj.choices = obj.choices.map(s => s.trim())
      obj.choices = obj.choices.filter(s => s)
      //recursion alert!
      obj.choices = obj.choices.map(str => {
        return str.split(/ /g).map(s => parseToken(s, opts))
      })
      w = ''
    }

    //root/sense overloaded
    if (start(w) === '{' && end(w) === '}') {
      w = stripBoth(w)
      // obj.sense = w
      obj.root = w
      if (/\//.test(w)) {
        let split = obj.root.split(/\//)
        obj.root = split[0]
        obj.pos = split[1]
        if (obj.pos === 'adj') {
          obj.pos = 'Adjective'
        }
        // titlecase
        obj.pos = obj.pos.charAt(0).toUpperCase() + obj.pos.substr(1).toLowerCase()
        // add sense-number too
        if (split[2] !== undefined) {
          obj.sense = split[2]
        }
      }
      return obj
    }
    //chunks
    if (start(w) === '<' && end(w) === '>') {
      w = stripBoth(w)
      obj.chunk = titleCase(w)
      obj.greedy = true
      return obj
    }
    if (start(w) === '%' && end(w) === '%') {
      w = stripBoth(w)
      obj.switch = w
      return obj
    }
  }
  //do the actual token content
  if (start(w) === '#') {
    obj.tag = stripStart(w)
    obj.tag = titleCase(obj.tag)
    return obj
  }
  //dynamic function on a term object
  if (start(w) === '@') {
    obj.method = stripStart(w)
    return obj
  }
  if (w === '.') {
    obj.anything = true
    return obj
  }
  //support alone-astrix
  if (w === '*') {
    obj.anything = true
    obj.greedy = true
    obj.optional = true
    return obj
  }
  if (w) {
    //somehow handle encoded-chars?
    w = w.replace('\\*', '*')
    w = w.replace('\\.', '.')
    if (opts.caseSensitive) {
      obj.use = 'text'
    } else {
      w = w.toLowerCase()
    }
    obj.word = w
  }
  return obj
}
export default parseToken
