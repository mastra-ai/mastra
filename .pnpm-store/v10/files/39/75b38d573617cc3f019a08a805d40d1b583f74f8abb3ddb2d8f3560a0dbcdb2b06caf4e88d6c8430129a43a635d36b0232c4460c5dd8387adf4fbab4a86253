(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
  typeof define === 'function' && define.amd ? define(['exports'], factory) :
  (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.efrt = {}));
})(this, (function (exports) { 'use strict';

  const commonPrefix = function (w1, w2) {
    let len = Math.min(w1.length, w2.length);
    while (len > 0) {
      const prefix = w1.slice(0, len);
      if (prefix === w2.slice(0, len)) {
        return prefix
      }
      len -= 1;
    }
    return ''
  };

  /* Sort elements and remove duplicates from array (modified in place) */
  const unique = function (a) {
    a.sort();
    for (let i = 1; i < a.length; i++) {
      if (a[i - 1] === a[i]) {
        a.splice(i, 1);
      }
    }
  };

  var fns = {
    commonPrefix,
    unique
  };

  const Histogram = function () {
    this.counts = {};
  };

  const methods$1 = {
    init: function (sym) {
      if (this.counts[sym] === undefined) {
        this.counts[sym] = 0;
      }
    },
    add: function (sym, n) {
      if (n === undefined) {
        n = 1;
      }
      this.init(sym);
      this.counts[sym] += n;
    },
    countOf: function (sym) {
      this.init(sym);
      return this.counts[sym]
    },
    highest: function (top) {
      let sorted = [];
      const keys = Object.keys(this.counts);
      for (let i = 0; i < keys.length; i++) {
        const sym = keys[i];
        sorted.push([sym, this.counts[sym]]);
      }
      sorted.sort(function (a, b) {
        return b[1] - a[1]
      });
      if (top) {
        sorted = sorted.slice(0, top);
      }
      return sorted
    }
  };

  Object.keys(methods$1).forEach(function (k) {
    Histogram.prototype[k] = methods$1[k];
  });

  const BASE = 36;
  const seq = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  const cache = seq.split('').reduce(function (h, c, i) {
    h[c] = i;
    return h
  }, {});

  // 0, 1, 2, ..., A, B, C, ..., 00, 01, ... AA, AB, AC, ..., AAA, AAB, ...
  const toAlphaCode = function (n) {
    if (seq[n] !== undefined) {
      return seq[n]
    }
    let places = 1;
    let range = BASE;
    let s = '';
    for (; n >= range; n -= range, places++, range *= BASE) {}
    while (places--) {
      const d = n % BASE;
      s = String.fromCharCode((d < 10 ? 48 : 55) + d) + s;
      n = (n - d) / BASE;
    }
    return s
  };

  const fromAlphaCode = function (s) {
    if (cache[s] !== undefined) {
      return cache[s]
    }
    let n = 0;
    let places = 1;
    let range = BASE;
    let pow = 1;
    for (; places < s.length; n += range, places++, range *= BASE) {}
    for (let i = s.length - 1; i >= 0; i--, pow *= BASE) {
      let d = s.charCodeAt(i) - 48;
      if (d > 10) {
        d -= 7;
      }
      n += d * pow;
    }
    return n
  };

  var encoding = {
    toAlphaCode,
    fromAlphaCode
  };

  const config = {
    NODE_SEP: ';',
    KEY_VAL: ':',
    STRING_SEP: ',',
    TERMINAL_PREFIX: '!',
    BASE: 36
  };
  // Return packed representation of Trie as a string.
  // Return packed representation of Trie as a string.
  //
  // Each node of the Trie is output on a single line.
  //
  // For example Trie("the them there thesis this"):
  // {
  //    "th": {
  //      "is": 1,
  //      "e": {
  //        "": 1,
  //        "m": 1,
  //        "re": 1,
  //        "sis": 1
  //      }
  //    }
  //  }
  //
  // Would be reperesented as:
  //
  // th0
  // e0is
  // !m,re,sis
  //
  // The line begins with a '!' iff it is a terminal node of the Trie.
  // For each string property in a node, the string is listed, along
  // with a (relative!) line number of the node that string references.
  // Terminal strings (those without child node references) are
  // separated by ',' characters.
  const nodeLine = function (self, node) {
    let line = '',
      sep = '';
    if (self.isTerminal(node)) {
      line += config.TERMINAL_PREFIX;
    }
    const props = self.nodeProps(node);
    for (let i = 0; i < props.length; i++) {
      const prop = props[i];
      if (typeof node[prop] === 'number') {
        line += sep + prop;
        sep = config.STRING_SEP;
        continue
      }
      if (self.syms[node[prop]._n]) {
        line += sep + prop + self.syms[node[prop]._n];
        sep = '';
        continue
      }
      let ref = encoding.toAlphaCode(node._n - node[prop]._n - 1 + self.symCount);
      // Large reference to smaller string suffix -> duplicate suffix
      if (node[prop]._g && ref.length >= node[prop]._g.length && node[node[prop]._g] === 1) {
        ref = node[prop]._g;
        line += sep + prop + ref;
        sep = config.STRING_SEP;
        continue
      }
      line += sep + prop + ref;
      sep = '';
    }
    return line
  };

  const analyzeRefs = function (self, node) {
    if (self.visited(node)) {
      return
    }
    const props = self.nodeProps(node, true);
    for (let i = 0; i < props.length; i++) {
      const prop = props[i];
      const ref = node._n - node[prop]._n - 1;
      // Count the number of single-character relative refs
      if (ref < config.BASE) {
        self.histRel.add(ref);
      }
      // Count the number of characters saved by converting an absolute
      // reference to a one-character symbol.
      self.histAbs.add(node[prop]._n, encoding.toAlphaCode(ref).length - 1);
      analyzeRefs(self, node[prop]);
    }
  };

  const symbolCount = function (self) {
    self.histAbs = self.histAbs.highest(config.BASE);
    const savings = [];
    savings[-1] = 0;
    let best = 0,
      sCount = 0;
    const defSize = 3 + encoding.toAlphaCode(self.nodeCount).length;
    for (let sym = 0; sym < config.BASE; sym++) {
      if (self.histAbs[sym] === undefined) {
        break
      }
      savings[sym] =
        self.histAbs[sym][1] -
        defSize -
        self.histRel.countOf(config.BASE - sym - 1) +
        savings[sym - 1];
      if (savings[sym] >= best) {
        best = savings[sym];
        sCount = sym + 1;
      }
    }
    return sCount
  };

  const numberNodes = function (self, node) {
    // Topological sort into nodes array
    if (node._n !== undefined) {
      return
    }
    const props = self.nodeProps(node, true);
    for (let i = 0; i < props.length; i++) {
      numberNodes(self, node[props[i]]); //recursive
    }
    node._n = self.pos++;
    self.nodes.unshift(node);
  };

  const pack$1 = function (self) {
    self.nodes = [];
    self.nodeCount = 0;
    self.syms = {};
    self.symCount = 0;
    self.pos = 0;
    // Make sure we've combined all the common suffixes
    self.optimize();
    self.histAbs = new Histogram();
    self.histRel = new Histogram();
    numberNodes(self, self.root);
    self.nodeCount = self.nodes.length;
    self.prepDFS();
    analyzeRefs(self, self.root);
    self.symCount = symbolCount(self);
    for (let sym = 0; sym < self.symCount; sym++) {
      self.syms[self.histAbs[sym][0]] = encoding.toAlphaCode(sym);
    }
    for (let i = 0; i < self.nodeCount; i++) {
      self.nodes[i] = nodeLine(self, self.nodes[i]);
    }
    // Prepend symbols
    for (let sym = self.symCount - 1; sym >= 0; sym--) {
      self.nodes.unshift(
        encoding.toAlphaCode(sym) +
          config.KEY_VAL +
          encoding.toAlphaCode(self.nodeCount - self.histAbs[sym][0] - 1)
      );
    }
    return self.nodes.join(config.NODE_SEP)
  };

  const NOT_ALLOWED = new RegExp('[0-9A-Z,;!:|¦]'); //characters banned from entering the trie
  // reserved propery names
  const internal = {
    _d: true,
    _v: true,
    _c: true,
    _g: true,
    _n: true,
  };

  const methods = {
    // Insert words from one big string, or from an array.
    insertWords: function (words) {
      if (words === undefined) {
        return
      }
      if (typeof words === 'string') {
        words = words.split(/[^a-zA-Z]+/);
      }
      for (let i = 0; i < words.length; i++) {
        words[i] = words[i].toLowerCase();
      }
      fns.unique(words);
      for (let i = 0; i < words.length; i++) {
        if (words[i].match(NOT_ALLOWED) === null) {
          this.insert(words[i]);
        }
      }
    },

    insert: function (word) {
      this._insert(word, this.root);
      const lastWord = this.lastWord;
      this.lastWord = word;

      const prefix = fns.commonPrefix(word, lastWord);
      if (prefix === lastWord) {
        return
      }

      const freeze = this.uniqueNode(lastWord, word, this.root);
      if (freeze) {
        this.combineSuffixNode(freeze);
      }
    },

    _insert: function (word, node) {
      let prefix, next;

      // Duplicate word entry - ignore
      if (word.length === 0) {
        return
      }

      // Do any existing props share a common prefix?
      const keys = Object.keys(node);
      for (let i = 0; i < keys.length; i++) {
        const prop = keys[i];
        prefix = fns.commonPrefix(word, prop);
        if (prefix.length === 0) {
          continue
        }
        // Prop is a proper prefix - recurse to child node
        if (prop === prefix && typeof node[prop] === 'object') {
          this._insert(word.slice(prefix.length), node[prop]);
          return
        }
        // Duplicate terminal string - ignore
        if (prop === word && typeof node[prop] === 'number') {
          return
        }
        next = {};
        next[prop.slice(prefix.length)] = node[prop];
        this.addTerminal(next, word = word.slice(prefix.length));
        delete node[prop];
        node[prefix] = next;
        this.wordCount++;
        return
      }

      // No shared prefix.  Enter the word here as a terminal string.
      this.addTerminal(node, word);
      this.wordCount++;
    },

    // Add a terminal string to node.
    // If 2 characters or less, just add with value == 1.
    // If more than 2 characters, point to shared node
    // Note - don't prematurely share suffixes - these
    // terminals may become split and joined with other
    // nodes in this part of the tree.
    addTerminal: function (node, prop) {
      if (prop.length <= 1) {
        node[prop] = 1;
        return
      }
      const next = {};
      node[prop[0]] = next;
      this.addTerminal(next, prop.slice(1));
    },

    // Well ordered list of properties in a node (string or object properties)
    // Use nodesOnly==true to return only properties of child nodes (not
    // terminal strings.
    nodeProps: function (node, nodesOnly) {
      const props = [];
      for (const prop in node) {
        // is it a usuable prop, or a special reserved one?
        if (prop !== '' && !internal.hasOwnProperty(prop)) {
          if (!nodesOnly || typeof node[prop] === 'object') {
            props.push(prop);
          }
        }
      }
      props.sort();
      return props
    },

    optimize: function () {
      this.combineSuffixNode(this.root);
      this.prepDFS();
      this.countDegree(this.root);
      this.prepDFS();
      this.collapseChains(this.root);
    },

    // Convert Trie to a DAWG by sharing identical nodes
    combineSuffixNode: function (node) {
      // Frozen node - can't change.
      if (node._c) {
        return node
      }
      // Make sure all children are combined and generate unique node
      // signature for this node.
      let sig = [];
      if (this.isTerminal(node)) {
        sig.push('!');
      }
      const props = this.nodeProps(node);
      for (let i = 0; i < props.length; i++) {
        const prop = props[i];
        if (typeof node[prop] === 'object') {
          node[prop] = this.combineSuffixNode(node[prop]);
          sig.push(prop);
          sig.push(node[prop]._c);
        } else {
          sig.push(prop);
        }
      }
      sig = sig.join('-');

      const shared = this.suffixes[sig];
      if (shared) {
        return shared
      }
      this.suffixes[sig] = node;
      node._c = this.cNext++;
      return node
    },

    prepDFS: function () {
      this.vCur++;
    },

    visited: function (node) {
      if (node._v === this.vCur) {
        return true
      }
      node._v = this.vCur;
      return false
    },

    countDegree: function (node) {
      if (node._d === undefined) {
        node._d = 0;
      }
      node._d++;
      if (this.visited(node)) {
        return
      }
      const props = this.nodeProps(node, true);
      for (let i = 0; i < props.length; i++) {
        this.countDegree(node[props[i]]);
      }
    },

    // Remove intermediate singleton nodes by hoisting into their parent
    collapseChains: function (node) {
      let prop, child, i;
      if (this.visited(node)) {
        return
      }
      const props = this.nodeProps(node);
      for (i = 0; i < props.length; i++) {
        prop = props[i];
        child = node[prop];
        if (typeof child !== 'object') {
          continue
        }
        this.collapseChains(child);
        // Hoist the singleton child's single property to the parent
        if (child._g !== undefined && (child._d === 1 || child._g.length === 1)) {
          delete node[prop];
          prop += child._g;
          node[prop] = child[child._g];
        }
      }
      // Identify singleton nodes
      if (props.length === 1 && !this.isTerminal(node)) {
        node._g = prop;
      }
    },

    isTerminal: function (node) {
      return !!node['']
    },

    // Find highest node in Trie that is on the path to word
    // and that is NOT on the path to other.
    uniqueNode: function (word, other, node) {
      const props = this.nodeProps(node, true);
      for (let i = 0; i < props.length; i++) {
        const prop = props[i];
        if (prop === word.slice(0, prop.length)) {
          if (prop !== other.slice(0, prop.length)) {
            return node[prop]
          }
          return this.uniqueNode(word.slice(prop.length), other.slice(prop.length), node[prop])
        }
      }
      return undefined
    },

    pack: function () {
      return pack$1(this)
    }
  };

  /*
   A JavaScript implementation of a Trie search datastructure.
  Each node of the Trie is an Object that can contain the following properties:
        '' - If present (with value == 1), the node is a Terminal Node - the prefix
            leading to this node is a word in the dictionary.
        numeric properties (value == 1) - the property name is a terminal string
            so that the prefix + string is a word in the dictionary.
        Object properties - the property name is one or more characters to be consumed
            from the prefix of the test string, with the remainder to be checked in
            the child node.
        '_c': A unique name for the node (starting from 1), used in combining Suffixes.
        '_n': Created when packing the Trie, the sequential node number
            (in pre-order traversal).
        '_d': The number of times a node is shared (it's in-degree from other nodes).
        '_v': Visited in DFS.
        '_g': For singleton nodes, the name of it's single property.
   */
  const Trie = function (words) {
    this.root = {};
    this.lastWord = '';
    this.suffixes = {};
    this.suffixCounts = {};
    this.cNext = 1;
    this.wordCount = 0;
    this.insertWords(words);
    this.vCur = 0;
  };

  Object.keys(methods).forEach(function (k) {
    Trie.prototype[k] = methods[k];
  });

  const isArray = function (input) {
    return Object.prototype.toString.call(input) === '[object Array]'
  };

  const handleFormats = function (input) {
    //null
    if (input === null || input === undefined) {
      return {}
    }
    //string
    if (typeof input === 'string') {
      return input.split(/ +/g).reduce(function (h, str) {
        h[str] = true;
        return h
      }, {})
    }
    //array
    if (isArray(input)) {
      return input.reduce(function (h, str) {
        h[str] = true;
        return h
      }, {})
    }
    //object
    return input
  };

  //turn an array into a compressed string
  const pack = function (obj) {
    obj = handleFormats(obj);
    //pivot into categories:
    const flat = Object.keys(obj).reduce(function (h, k) {
      const val = obj[k];
      //array version-
      //put it in several buckets
      if (isArray(val)) {
        for (let i = 0; i < val.length; i++) {
          h[val[i]] = h[val[i]] || [];
          h[val[i]].push(k);
        }
        return h
      }
      //normal string/boolean version
      if (h.hasOwnProperty(val) === false) {
        //basically h[val]=[]  - support reserved words
        Object.defineProperty(h, val, {
          writable: true,
          enumerable: true,
          configurable: true,
          value: []
        });
      }
      h[val].push(k);
      return h
    }, {});
    //pack each into a compressed string
    Object.keys(flat).forEach(function (k) {
      const t = new Trie(flat[k]);
      flat[k] = t.pack();
    });
    return Object.keys(flat)
      .map((k) => {
        return k + '¦' + flat[k]
      })
      .join('|')
  };

  const symbols = function (t) {
    //... process these lines
    const reSymbol = new RegExp('([0-9A-Z]+):([0-9A-Z]+)');
    for (let i = 0; i < t.nodes.length; i++) {
      const m = reSymbol.exec(t.nodes[i]);
      if (!m) {
        t.symCount = i;
        break
      }
      t.syms[encoding.fromAlphaCode(m[1])] = encoding.fromAlphaCode(m[2]);
    }
    //remove from main node list
    t.nodes = t.nodes.slice(t.symCount, t.nodes.length);
  };

  // References are either absolute (symbol) or relative (1 - based)
  const indexFromRef = function (trie, ref, index) {
    const dnode = encoding.fromAlphaCode(ref);
    if (dnode < trie.symCount) {
      return trie.syms[dnode]
    }
    return index + dnode + 1 - trie.symCount
  };

  const toArray = function (trie) {
    const all = [];
    const crawl = (index, pref) => {
      let node = trie.nodes[index];
      if (node[0] === '!') {
        all.push(pref);
        node = node.slice(1); //ok, we tried. remove it.
      }
      const matches = node.split(/([A-Z0-9,]+)/g);
      for (let i = 0; i < matches.length; i += 2) {
        const str = matches[i];
        const ref = matches[i + 1];
        if (!str) {
          continue
        }
        const have = pref + str;
        //branch's end
        if (ref === ',' || ref === undefined) {
          all.push(have);
          continue
        }
        const newIndex = indexFromRef(trie, ref, index);
        crawl(newIndex, have);
      }
    };
    crawl(0, '');
    return all
  };

  //PackedTrie - Trie traversal of the Trie packed-string representation.
  const unpack$1 = function (str) {
    const trie = {
      nodes: str.split(';'),
      syms: [],
      symCount: 0
    };
    //process symbols, if they have them
    if (str.match(':')) {
      symbols(trie);
    }
    return toArray(trie)
  };

  const unpack = function (str) {
    if (!str) {
      return {}
    }
    //turn the weird string into a key-value object again
    const obj = str.split('|').reduce((h, s) => {
      const arr = s.split('¦');
      h[arr[0]] = arr[1];
      return h
    }, {});
    const all = {};
    Object.keys(obj).forEach(function (cat) {
      const arr = unpack$1(obj[cat]);
      //special case, for botched-boolean
      if (cat === 'true') {
        cat = true;
      }
      for (let i = 0; i < arr.length; i++) {
        const k = arr[i];
        if (all.hasOwnProperty(k) === true) {
          if (Array.isArray(all[k]) === false) {
            all[k] = [all[k], cat];
          } else {
            all[k].push(cat);
          }
        } else {
          all[k] = cat;
        }
      }
    });
    return all
  };

  var _version = '2.7.0';

  exports.pack = pack;
  exports.unpack = unpack;
  exports.version = _version;

  Object.defineProperty(exports, '__esModule', { value: true });

}));
