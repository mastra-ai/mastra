const prefixes = {
  '¢': 'cents',
  $: 'dollars',
  '£': 'pounds',
  '¥': 'yen',
  '€': 'euros',
  '₡': 'colón',
  '฿': 'baht',
  '₭': 'kip',
  '₩': 'won',
  '₹': 'rupees',
  '₽': 'ruble',
  '₺': 'liras',
}
const suffixes = {
  '%': 'percent',
  // s: 'seconds',
  // cm: 'centimetres',
  // km: 'kilometres',
  // ft: 'feet',
  '°': 'degrees'
}

const addSuffix = function (obj) {
  let res = {
    suffix: '',
    prefix: obj.prefix,
  }
  // $5 to 'five dollars'
  if (prefixes.hasOwnProperty(obj.prefix)) {
    res.suffix += ' ' + prefixes[obj.prefix]
    res.prefix = ''
  }
  // 5% to 'five percent'
  if (suffixes.hasOwnProperty(obj.suffix)) {
    res.suffix += ' ' + suffixes[obj.suffix]
  }
  if (res.suffix && obj.num === 1) {
    res.suffix = res.suffix.replace(/s$/, '')
  }
  // misc other suffixes
  if (!res.suffix && obj.suffix) {
    res.suffix += ' ' + obj.suffix
  }
  return res
}

export default addSuffix