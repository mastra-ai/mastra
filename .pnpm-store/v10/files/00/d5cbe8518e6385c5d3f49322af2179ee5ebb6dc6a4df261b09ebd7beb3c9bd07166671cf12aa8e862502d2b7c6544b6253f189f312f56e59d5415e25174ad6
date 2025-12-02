

export const getGroup = function (state, term_index) {
  if (state.groups[state.inGroup]) {
    return state.groups[state.inGroup]
  }
  state.groups[state.inGroup] = {
    start: term_index,
    length: 0,
  }
  return state.groups[state.inGroup]
}
