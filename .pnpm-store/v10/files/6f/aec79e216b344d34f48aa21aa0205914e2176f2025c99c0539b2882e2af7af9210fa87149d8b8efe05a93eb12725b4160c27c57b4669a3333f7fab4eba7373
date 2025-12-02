import type { ElementType, MemoExoticComponent, ReactElement } from 'react'
import { React } from './react'

// Directly ported from:
// https://unpkg.com/browse/react-is@19.0.0/cjs/react-is.production.js
// It's very possible this could change in the future, but given that
// we only use these in `connect`, this is a low priority.

export const IS_REACT_19 = /* @__PURE__ */ React.version.startsWith('19')

const REACT_ELEMENT_TYPE = /* @__PURE__ */ Symbol.for(
  IS_REACT_19 ? 'react.transitional.element' : 'react.element',
)
const REACT_PORTAL_TYPE = /* @__PURE__ */ Symbol.for('react.portal')
const REACT_FRAGMENT_TYPE = /* @__PURE__ */ Symbol.for('react.fragment')
const REACT_STRICT_MODE_TYPE = /* @__PURE__ */ Symbol.for('react.strict_mode')
const REACT_PROFILER_TYPE = /* @__PURE__ */ Symbol.for('react.profiler')
const REACT_CONSUMER_TYPE = /* @__PURE__ */ Symbol.for('react.consumer')
const REACT_CONTEXT_TYPE = /* @__PURE__ */ Symbol.for('react.context')
const REACT_FORWARD_REF_TYPE = /* @__PURE__ */ Symbol.for('react.forward_ref')
const REACT_SUSPENSE_TYPE = /* @__PURE__ */ Symbol.for('react.suspense')
const REACT_SUSPENSE_LIST_TYPE = /* @__PURE__ */ Symbol.for(
  'react.suspense_list',
)
const REACT_MEMO_TYPE = /* @__PURE__ */ Symbol.for('react.memo')
const REACT_LAZY_TYPE = /* @__PURE__ */ Symbol.for('react.lazy')
const REACT_OFFSCREEN_TYPE = /* @__PURE__ */ Symbol.for('react.offscreen')
const REACT_CLIENT_REFERENCE = /* @__PURE__ */ Symbol.for(
  'react.client.reference',
)

export const ForwardRef = REACT_FORWARD_REF_TYPE
export const Memo = REACT_MEMO_TYPE

export function isValidElementType(type: any): type is ElementType {
  return typeof type === 'string' ||
    typeof type === 'function' ||
    type === REACT_FRAGMENT_TYPE ||
    type === REACT_PROFILER_TYPE ||
    type === REACT_STRICT_MODE_TYPE ||
    type === REACT_SUSPENSE_TYPE ||
    type === REACT_SUSPENSE_LIST_TYPE ||
    type === REACT_OFFSCREEN_TYPE ||
    (typeof type === 'object' &&
      type !== null &&
      (type.$$typeof === REACT_LAZY_TYPE ||
        type.$$typeof === REACT_MEMO_TYPE ||
        type.$$typeof === REACT_CONTEXT_TYPE ||
        type.$$typeof === REACT_CONSUMER_TYPE ||
        type.$$typeof === REACT_FORWARD_REF_TYPE ||
        type.$$typeof === REACT_CLIENT_REFERENCE ||
        type.getModuleId !== undefined))
    ? !0
    : !1
}

function typeOf(object: any): symbol | undefined {
  if (typeof object === 'object' && object !== null) {
    const { $$typeof } = object

    switch ($$typeof) {
      case REACT_ELEMENT_TYPE:
        switch (((object = object.type), object)) {
          case REACT_FRAGMENT_TYPE:
          case REACT_PROFILER_TYPE:
          case REACT_STRICT_MODE_TYPE:
          case REACT_SUSPENSE_TYPE:
          case REACT_SUSPENSE_LIST_TYPE:
            return object
          default:
            switch (((object = object && object.$$typeof), object)) {
              case REACT_CONTEXT_TYPE:
              case REACT_FORWARD_REF_TYPE:
              case REACT_LAZY_TYPE:
              case REACT_MEMO_TYPE:
                return object
              case REACT_CONSUMER_TYPE:
                return object
              default:
                return $$typeof
            }
        }
      case REACT_PORTAL_TYPE:
        return $$typeof
    }
  }
}

export function isContextConsumer(object: any): object is ReactElement {
  return IS_REACT_19
    ? typeOf(object) === REACT_CONSUMER_TYPE
    : typeOf(object) === REACT_CONTEXT_TYPE
}

export function isMemo(object: any): object is MemoExoticComponent<any> {
  return typeOf(object) === REACT_MEMO_TYPE
}
