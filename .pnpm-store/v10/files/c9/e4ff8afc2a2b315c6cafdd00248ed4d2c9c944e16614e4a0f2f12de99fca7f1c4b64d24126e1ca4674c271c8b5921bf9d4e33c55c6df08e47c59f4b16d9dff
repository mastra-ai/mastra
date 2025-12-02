import getUnion from './lib/union.js'
import getDifference from './lib/difference.js'
import getIntersection from './lib/intersection.js'

const isArray = function (arr) {
  return Object.prototype.toString.call(arr) === '[object Array]'
}

const getDoc = (m, view) => {
  if (typeof m === 'string' || isArray(m)) {
    return view.match(m)
  }
  if (!m) {
    return view.none()
  }
  // support pre-parsed reg object
  return m
}

// 'harden' our json pointers, again
const addIds = function (ptrs, docs) {
  return ptrs.map(ptr => {
    let [n, start] = ptr
    if (docs[n] && docs[n][start]) {
      ptr[3] = docs[n][start].id
    }
    return ptr
  })
}

const methods = {}

// all parts, minus duplicates
methods.union = function (m) {
  m = getDoc(m, this)
  let ptrs = getUnion(this.fullPointer, m.fullPointer)
  ptrs = addIds(ptrs, this.document)
  return this.toView(ptrs)
}
methods.and = methods.union

// only parts they both have
methods.intersection = function (m) {
  m = getDoc(m, this)
  let ptrs = getIntersection(this.fullPointer, m.fullPointer)
  ptrs = addIds(ptrs, this.document)
  return this.toView(ptrs)
}

// only parts of a that b does not have
methods.not = function (m) {
  m = getDoc(m, this)
  let ptrs = getDifference(this.fullPointer, m.fullPointer)
  ptrs = addIds(ptrs, this.document)
  return this.toView(ptrs)
}
methods.difference = methods.not

// get opposite of a match
methods.complement = function () {
  let doc = this.all()
  let ptrs = getDifference(doc.fullPointer, this.fullPointer)
  ptrs = addIds(ptrs, this.document)
  return this.toView(ptrs)
}

// remove overlaps
methods.settle = function () {
  let ptrs = this.fullPointer
  ptrs.forEach(ptr => {
    ptrs = getUnion(ptrs, [ptr])
  })
  ptrs = addIds(ptrs, this.document)
  return this.update(ptrs)
}

const addAPI = function (View) {
  // add set/intersection/union
  Object.assign(View.prototype, methods)
}
export default addAPI
