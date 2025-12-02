// wire-up more pos-tags to our model
const addTags = function (tags) {
  const { model, methods } = this.world()
  const tagSet = model.one.tagSet
  const fn = methods.one.addTags
  let res = fn(tags, tagSet)
  model.one.tagSet = res
  return this
}

export default { addTags }