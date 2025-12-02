var test = require('tape')
var pctEncode = require('./index.js')

test('Does it work?', function (t) {
  t.plan(1)
  var encode = pctEncode(/[^\w~.\-]/g);

  t.equal(encode("UTF-8 in your URIs: ✓✓"),
                 "UTF-8%20in%20your%20URIs%3A%20%E2%9C%93%E2%9C%93");
})
