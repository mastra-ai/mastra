export let effect = (stores, callback) => {
  if (!Array.isArray(stores)) stores = [stores]

  let unbinds = []
  let lastRunUnbind

  let run = () => {
    lastRunUnbind && lastRunUnbind()

    let values = stores.map(store => store.get())
    lastRunUnbind = callback(...values)
  }

  unbinds = stores.map(store => store.listen(run))
  run()

  return () => {
    unbinds.forEach(unbind => unbind())
    lastRunUnbind && lastRunUnbind()
  }
}
