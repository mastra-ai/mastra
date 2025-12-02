<div align="center">
  <img src="https://cloud.githubusercontent.com/assets/399657/23590290/ede73772-01aa-11e7-8915-181ef21027bc.png" />
  <div>cute graph-traversal</div>
  <a href="https://npmjs.org/package/grad-school">
    <img src="https://img.shields.io/npm/v/grad-school.svg?style=flat-square" />
  </a>
  <!-- <a href="https://www.codacy.com/app/spencerkelly86/grad-school">
    <img src="https://api.codacy.com/project/badge/Coverage/fc03e2761c8c471c8f84141abf2704de" />
  </a> -->
  <a href="https://unpkg.com/grad-school/builds/grad-school.mjs">
     <img src="https://badge-size.herokuapp.com/spencermountain/grad-school/master/builds/grad-school.mjs" />
  </a>
  <!-- <a href="https://nodejs.org/api/documentation.html#documentation_stability_index">
    <img src="https://img.shields.io/badge/stability-stable-green.svg?style=flat-square" />
  </a> -->
</div>

<div align="center">
  <code>npm install grad-school</code>
</div>

<!-- spacer -->
<img height="25px" src="https://user-images.githubusercontent.com/399657/68221862-17ceb980-ffb8-11e9-87d4-7b30b6488f16.png"/>

**grad-school** is a tool for creating ad-hoc graphs, in a scripting language, and then querying them.

it's surprising how there's no super-clear way to author graph-data, or even think about.

It always hurts my head. Even simple graphs do.

Maybe i have a head-problem, or maybe JSON is just an awkward way to represent graphs.

either way...

library is like, 3kb.

<!-- spacer -->
<img height="85px" src="https://user-images.githubusercontent.com/399657/68221862-17ceb980-ffb8-11e9-87d4-7b30b6488f16.png"/>

---

### Ok, graphs -

we support 3 formats:

### String-format

this is a pretty-flexible way to declare a graph, using indents and `->` syntax. It's harder to add metadata to nodes.
It's a bit like how graphviz does it:

```js
let str = `
a -> a2 -> a21
  -> a1
b
`
let g = grad(str).debug()
g.nodes().length // 5
```

### flat json:

this flat, parent-indexed json is easy to make, but the graph is harder to 'see':

```js
let nodes = [
  { id: 'a', parent: null },
  { id: 'b', parent: null },
  { id: 'a1', parent: 'a' },
  { id: 'a2', parent: 'a' },
  { id: 'a21', parent: 'a2' },
]
let g = grad(str).debug()
/*
  → a
      → a2
            → a21
      → a1
  → b
*/
```

### nested json:

this is how d3 does it:

```js
let nodes = {
  children: [
    {
      id: 'a',
      children: [{ id: 'a1' }, { id: 'a2', children: [{ id: 'a21' }] }],
    },
    { id: 'b' },
  ],
}
let g = grad(str).debug()
/*
  → a
      → a2
            → a21
      → a1
  → b
*/
```

<!-- spacer -->
<img height="85px" src="https://user-images.githubusercontent.com/399657/68221862-17ceb980-ffb8-11e9-87d4-7b30b6488f16.png"/>

## JS API

you can also easily mess-around with the graph:

```js
let g = grad('a -> a1')

// add new nodes
g.add('b').add(['b1', 'b2'])
g.add('c')

// get a node by a json-pointer
g.get('/b/b1').remove()
console.log(g.get('b').children)

console.log(g.out())
```

## Fill-down

you can 'deduce', down the tree, and intellegently merge the properties of each node:

```js
let str = `
a
b -> b1
c -> c1 -> c2
`
let g = grad(str)

// add some data to one node
g.get('c').props({ inC: true })
g.fillDown()

// check a c-leaf
g.get('c/c1/c2').json.props
// { inC: true }

g.get('b').json.props
// {}
```

it will concat arrays, merge objects and sets:

```js
let str = `
a -> a1 -> a11
b -> b1
`
let g = grad(str)
// add data to root
g.props({ list: ['fromRoot'] })
// add data to child
g.get('a').props({ list: ['fromA'] })
g.fillDown()

// b-side has root-data
let have = g.get('b/b1').json.props
// { list: ['fromRoot'] }

// a-side has merged arrays
let have = g.get('a/a1/a11').json.props
// { list: ['fromRoot','fromA'] }
```

MIT
