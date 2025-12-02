//support global multipliers, like 'half-million' by doing 'million' then multiplying by 0.5
const findModifiers = str => {
  const mults = [
    {
      reg: /^(minus|negative)[\s-]/i,
      mult: -1,
    },
    {
      reg: /^(a\s)?half[\s-](of\s)?/i,
      mult: 0.5,
    },
    //  {
    //   reg: /^(a\s)?quarter[\s\-]/i,
    //   mult: 0.25
    // }
  ]
  for (let i = 0; i < mults.length; i++) {
    if (mults[i].reg.test(str) === true) {
      return {
        amount: mults[i].mult,
        str: str.replace(mults[i].reg, ''),
      }
    }
  }
  return {
    amount: 1,
    str: str,
  }
}

export default findModifiers
