// import irregularVerbs from './conjugations.js'
// harvest list of irregulars for any juicy word-data
const expandIrregulars = function (model) {
  const { irregularPlurals } = model.two
  const { lexicon } = model.one
  Object.entries(irregularPlurals).forEach(a => {
    lexicon[a[0]] = lexicon[a[0]] || 'Singular'
    lexicon[a[1]] = lexicon[a[1]] || 'Plural'
  })
  return model
}
export default expandIrregulars
