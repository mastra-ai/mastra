var bignumJSON = require('./lib');

var testDecimal = '{"normal":-922337203.234,"big":-9223372036854775807.4237482374983253298159}';
console.log('\ntestDecimal:                   ' + testDecimal);
console.log('JSON.parse(testDecimal):       ' + JSON.stringify(JSON.parse(testDecimal)));
console.log('bignumJSON.parse(testDecimal): ' + bignumJSON.stringify(bignumJSON.parse(testDecimal)));

var testInteger = '{"normal":-922337203,"big":-92233720368547758074237482374983253298159}';
console.log('\ntestInteger:                   ' + testInteger);
console.log('JSON.parse(testInteger):       ' + JSON.stringify(JSON.parse(testInteger)));
console.log('bignumJSON.parse(testInteger): ' + bignumJSON.stringify(bignumJSON.parse(testInteger)));
