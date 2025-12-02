/* suffix-thumb 5.0.2 MIT */
(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
  typeof define === 'function' && define.amd ? define(['exports'], factory) :
  (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.suffixThumb = {}));
})(this, (function (exports) { 'use strict';

  // 01- full-word exceptions
  const checkEx = function (str, ex = {}) {
    if (ex.hasOwnProperty(str)) {
      return ex[str]
    }
    return null
  };

  // 02- suffixes that pass our word through
  const checkSame = function (str, same = []) {
    for (let i = 0; i < same.length; i += 1) {
      if (str.endsWith(same[i])) {
        return str
      }
    }
    return null
  };

  // 03- check rules - longest first
  const checkRules = function (str, fwd, both = {}) {
    fwd = fwd || {};
    let max = str.length - 1;
    // look for a matching suffix
    for (let i = max; i >= 1; i -= 1) {
      let size = str.length - i;
      let suff = str.substring(size, str.length);
      // check fwd rules, first
      if (fwd.hasOwnProperty(suff) === true) {
        return str.slice(0, size) + fwd[suff]
      }
      // check shared rules
      if (both.hasOwnProperty(suff) === true) {
        return str.slice(0, size) + both[suff]
      }
    }
    // try a fallback transform
    if (fwd.hasOwnProperty('')) {
      return str += fwd['']
    }
    if (both.hasOwnProperty('')) {
      return str += both['']
    }
    return null
  };

  //sweep-through all suffixes
  const convert$1 = function (str = '', model = {}) {
    // 01- check exceptions
    let out = checkEx(str, model.ex);
    // 02 - check same
    out = out || checkSame(str, model.same);
    // check forward and both rules
    out = out || checkRules(str, model.fwd, model.both);
    //return unchanged
    out = out || str;
    return out
  };

  const flipObj = function (obj) {
    return Object.entries(obj).reduce((h, a) => {
      h[a[1]] = a[0];
      return h
    }, {})
  };

  const reverse = function (model = {}) {
    return {
      reversed: true,
      // keep these two
      both: flipObj(model.both),
      ex: flipObj(model.ex),
      // swap this one in
      fwd: model.rev || {}
    }
  };

  // make sure inputs are not impossible to square-up
  const validate = function (pairs, opts = {}) {
    let left = new Set();
    let right = new Set();
    pairs = pairs.filter(a => {
      if (left.has(a[0])) {
        // console.log('dupe', a)
        return false
      }
      if (right.has(a[1])) {
        // console.log('dupe', a)
        return false
      }
      left.add(a[0]);
      right.add(a[1]);

      // ensure pairs are aligned by prefix
      // if (a[0].substring(0, 1) !== a[1].substring(0, 1)) {
      //   console.log('pair not aligned at prefix:', a)
      //   return false
      // }
      return true
    });
    return pairs
  };

  const prep = function (pairs, ex) {
    // remove dupes
    pairs = validate(pairs);
    // ensure pairs are prefix aligned, in the first-place
    return pairs.filter(arr => {
      let [a, b] = arr;
      if (a.substring(0, 1) !== b.substring(0, 1)) {
        ex[a] = b;
        return false
      }
      return true
    })
  };

  // get the suffix diff between a and b
  const generateRule = function (pair, peekLen = 0) {
    let all = [];
    let [from, to] = pair;
    for (let i = 0; i < from.length; i += 1) {
      if (from[i] === to[i]) {
        all.push(from[i]);
      } else {
        break
      }
    }
    let prefix = all.length - peekLen;
    // is our suffix just the whole word? (not allowed!)
    if (peekLen >= all.length) {
      return null
    }
    return {
      from: from.substring(prefix),
      to: to.substring(prefix)
    }
  };

  // check a rule
  const convert = function (str, rule) {
    if (rule.from.length >= str.length) {
      return null
    }
    if (str.endsWith(rule.from)) {
      let len = str.length - rule.from.length;
      let pre = str.slice(0, len);
      // if (str === 'agenouiller') {
      //   console.log(str, rule, pre + rule.to)
      // }
      return pre + rule.to
    }
    return null
  };
  // console.log(convert('asdfoo', { from: 'foo', to: 'dog' }))

  const getPercent = (part, total) => {
    if (total === 0) {
      return 100
    }
    let num = (part / total) * 100;
    num = Math.round(num * 10) / 10;
    return num;
  };

  // decide whether this rule performs well or not
  const considerRule = function (rule, pairs) {
    let total = 0;
    let clear = new Set();
    if (!rule) {
      return { total, percent: 0, rule, clear, count: 0 }
    }
    if (pairs.length === 0) {
      return { total, percent: 100, rule, clear, count: 0 }
    }
    pairs.forEach(pair => {
      let res = convert(pair[0], rule);
      if (res !== null) {
        total += 1;
        if (res === pair[1]) {
          clear.add(pair[0]);
        }
      }
    });
    return {
      total,
      count: clear.size,
      percent: getPercent(clear.size, total),
      rule,
      clear
    }
  };

  const findRules = function (pairs, finished, opts) {
    let pending = pairs.slice(0);
    let rules = {};
    // small rules first
    for (let peek = 0; peek < 6; peek += 1) {
      for (let i = 0; i < pending.length; i += 1) {
        let rule = generateRule(pending[i], peek);
        let result = considerRule(rule, pending);
        // did it do okay?
        if (result.rule && result.percent > opts.threshold && result.count > opts.min) {
          // ensure it does not interfere with existing pairs
          let res2 = considerRule(rule, finished);
          if (res2.percent < 100) {
            continue
          }

          // add it to our rules
          rules[rule.from] = rule.to;
          // update pending/finished lists
          pending = pending.filter(p => {
            if (result.clear.has(p[0])) {
              finished.push(p);
              return false
            }
            return true
          });
        }
      }
    }
    return { rules, pending, finished }
  };

  // some rules are also good in reverse
  const shareBackward = function (fwd, rev, opts) {
    let both = {};
    let pending = rev.slice(0);
    let finished = [];
    let rules = Object.entries(fwd).reverse();
    rules.forEach(a => {
      let rule = { from: a[1], to: a[0] };
      if (!rule.to) {
        return
      }
      let result = considerRule(rule, rev);
      // did it do okay?
      if (result.percent > opts.threshold) {
        // move it to 'both' rules
        both[rule.to] = rule.from;
        delete fwd[rule.to];
        // update finished/pending lists
        pending = pending.filter(a => {
          if (result.clear.has(a[0])) {
            finished.push(a);
            return false
          }
          return true
        });
      }
    });
    return {
      fwd,
      both,
      revPairs: {
        pending,
        finished
      }
    }
  };

  const defaults = {
    threshold: 80,
    min: 0
  };
  const swap$1 = (a) => [a[1], a[0]];

  const learn = function (pairs, opts = {}) {
    opts = Object.assign({}, defaults, opts);
    let ex = {};
    let rev = {};
    pairs = prep(pairs, ex);
    // get forward-dir rules
    let { rules, pending, finished } = findRules(pairs, [], opts);
    // move some to both
    let { fwd, both, revPairs } = shareBackward(rules, pairs.map(swap$1), opts);
    // generate remaining reverse-dir rules
    let pendingBkwd = [];
    if (opts.reverse !== false) {
      // console.log(revPairs.pending)
      let bkwd = findRules(revPairs.pending, revPairs.finished, opts);
      pendingBkwd = bkwd.pending;
      rev = bkwd.rules;
    }
    // console.log(pending.length, 'pending fwd')
    // console.log(pendingBkwd.length, 'pending Bkwd')
    // add anything remaining as an exception
    if (opts.min <= 1) {
      pending.forEach(arr => {
        ex[arr[0]] = arr[1];
      });
      pendingBkwd.forEach(arr => {
        ex[arr[1]] = arr[0];
      });
    }
    return {
      fwd,
      both,
      rev,
      ex,
    }
  };

  // longest common prefix
  const findOverlap = (from, to) => {
    let all = [];
    for (let i = 0; i < from.length; i += 1) {
      if (from[i] === to[i]) {
        all.push(from[i]);
      } else {
        break
      }
    }
    return all.join('')
  };

  // run-length encode any shared prefix
  let compress$1 = function (key, val) {
    let prefix = findOverlap(key, val);
    if (prefix.length < 1) {
      return val
    }
    let out = prefix.length + val.substr(prefix.length);
    return out
  };
  // console.log(compress('fixture', 'fixturing'))

  const pack = function (obj) {
    let byVal = {};
    Object.keys(obj).forEach(k => {
      let val = obj[k];
      byVal[val] = byVal[val] || [];
      byVal[val].push(k);
    });
    let out = [];
    Object.keys(byVal).forEach(val => {
      out.push(`${val}:${byVal[val].join(',')}`);
    });
    return out.join('¦')
  };

  const packObj = function (obj = {}) {
    let tmp = {};
    Object.keys(obj).forEach(k => {
      let val = compress$1(k, obj[k]);// compress any shared prefix
      tmp[k] = val;
    });
    return pack(tmp)
  };

  const compress = function (model) {
    let out = {
      fwd: packObj(model.fwd),
      both: packObj(model.both),
      rev: packObj(model.rev),
      ex: packObj(model.ex),
    };
    return out
  };


  // let model = {
  //   fwd: {
  //     foo: 'food',
  //     bar: 'bard',
  //     cool: 'nice'
  //   }
  // }
  // console.log(compress(model))

  const prefix = /^([0-9]+)/;

  const toObject = function (txt) {
    let obj = {};
    txt.split('¦').forEach(str => {
      let [key, vals] = str.split(':');
      vals = (vals || '').split(',');
      vals.forEach(val => {
        obj[val] = key;
      });
    });
    return obj
  };

  const growObject = function (key = '', val = '') {
    val = String(val);
    let m = val.match(prefix);
    if (m === null) {
      return val
    }
    let num = Number(m[1]) || 0;
    let pre = key.substring(0, num);
    let full = pre + val.replace(prefix, '');
    return full
  };

  const unpackOne = function (str) {
    let obj = toObject(str);
    return Object.keys(obj).reduce((h, k) => {
      h[k] = growObject(k, obj[k]);
      return h
    }, {})
  };

  const uncompress = function (model = {}) {
    if (typeof model === 'string') {
      model = JSON.parse(model);
    }
    model.fwd = unpackOne(model.fwd || '');
    model.both = unpackOne(model.both || '');
    model.rev = unpackOne(model.rev || '');
    model.ex = unpackOne(model.ex || '');
    return model
  };

  const cyan = str => '\x1b[36m' + str + '\x1b[0m';
  const blue = str => '\x1b[34m' + str + '\x1b[0m';

  const percent = (part, total) => {
    let num = (part / total) * 100;
    num = Math.round(num * 10) / 10;
    return num + '%'
  };

  const swap = (a) => [a[1], a[0]];

  const getNum = function (pairs, model) {
    let right = 0;
    pairs.forEach(a => {
      let have = convert$1(a[0], model);
      if (have === a[1]) {
        right += 1;
      } else {
        console.log('❌ ', a, '→ ' + have);
      }
    });
    return percent(right, pairs.length)
  };

  const test = function (pairs, model = {}) {
    pairs = validate(pairs);
    let fwdScore = getNum(pairs, model);
    let bkwdScore = getNum(pairs.map(swap), reverse(model));
    console.log(`${blue(fwdScore)}  -  🔄 ${cyan(bkwdScore)}`);
  };

  exports.compress = compress;
  exports.convert = convert$1;
  exports.learn = learn;
  exports.reverse = reverse;
  exports.test = test;
  exports.uncompress = uncompress;
  exports.validate = validate;

  Object.defineProperty(exports, '__esModule', { value: true });

}));
