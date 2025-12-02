module.exports = function pctEncode(regexp) {
  regexp = regexp || /\W/g;
  return function encode(string) {
    string = String(string);
    return string.replace(regexp, function (m) {
      var c = m[0].charCodeAt(0)
        , encoded = [];
      if (c < 128) {
        encoded.push(c);
      } else if ((128 <= c && c < 2048)) {
        encoded.push((c >> 6) | 192);
        encoded.push((c & 63) | 128);
      } else {
        encoded.push((c >> 12) | 224);
        encoded.push(((c >> 6) & 63) | 128);
        encoded.push((c & 63) | 128);
      }
      return encoded.map(function (c) {
        return '%' + c.toString(16).toUpperCase();
      }).join('');
    })
  }
}
