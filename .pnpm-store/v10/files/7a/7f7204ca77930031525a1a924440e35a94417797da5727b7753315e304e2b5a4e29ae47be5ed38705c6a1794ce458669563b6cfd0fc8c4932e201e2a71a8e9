const ones = 'one|two|three|four|five|six|seven|eight|nine'
const tens = 'twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|fourty'
const teens = 'eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen'

// this is a bit of a mess
// segment consecutive number-words into sensible chunks
const findNumbers = function (doc) {
  let m = doc.match('#Value+')

  //"50 83"
  if (m.has('#NumericValue #NumericValue')) {
    //a comma may mean two numbers
    if (m.has('#Value @hasComma #Value')) {
      m.splitAfter('@hasComma')
    } else if (m.has('#NumericValue #Fraction')) {
      m.splitAfter('#NumericValue #Fraction')
    } else {
      m = m.splitAfter('#NumericValue')
    }
  }

  //three-length
  if (m.has('#Value #Value #Value') && !m.has('#Multiple')) {
    //twenty-five-twenty
    if (m.has('(' + tens + ') #Cardinal #Cardinal')) {
      m = m.splitAfter('(' + tens + ') #Cardinal')
    }
  }

  //two-length ones
  if (m.has('#Value #Value')) {
    //june 21st 1992 is two seperate values
    if (m.has('#NumericValue #NumericValue')) {
      m = m.splitOn('#Year')
    }
    //sixty fifteen
    if (m.has('(' + tens + ') (' + teens + ')')) {
      m = m.splitAfter('(' + tens + ')')
    }

    //"72 82"
    let double = m.match('#Cardinal #Cardinal')
    if (double.found && !m.has('(point|decimal|#Fraction)')) {
      //not 'two hundred'
      if (!double.has('#Cardinal (#Multiple|point|decimal)')) {
        // two fifty five
        let noMultiple = m.has(`(${ones}) (${tens})`)
        // twenty one
        let tensVal = double.has('(' + tens + ') #Cardinal')
        // hundredOne
        let multVal = double.has('#Multiple #Value')
        //one proper way, 'twenty one', or 'hundred one'
        if (!noMultiple && !tensVal && !multVal) {
          // double = double.firstTerm()
          double.terms().forEach(d => {
            m = m.splitOn(d)
          })
        }
      }
    }

    //seventh fifth
    if (m.match('#Ordinal #Ordinal').match('#TextValue').found && !m.has('#Multiple')) {
      //the one proper way, 'twenty first'
      if (!m.has('(' + tens + ') #Ordinal')) {
        m = m.splitAfter('#Ordinal')
      }
    }
    //fifth five
    m = m.splitBefore('#Ordinal [#Cardinal]', 0)
    //five 2017 (support '5 hundred', and 'twenty 5'
    if (m.has('#TextValue #NumericValue') && !m.has('(' + tens + '|#Multiple)')) {
      m = m.splitBefore('#TextValue #NumericValue')
    }
  }

  //5-8
  m = m.splitAfter('#NumberRange')
  // june 5th 1999
  m = m.splitBefore('#Year')
  return m
}

export default findNumbers
