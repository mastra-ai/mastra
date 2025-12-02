/** patterns for turning 'bus' to 'buses'*/
const suffixes = {
  a: [
    [/(antenn|formul|nebul|vertebr|vit)a$/i, '$1ae'],
    [/ia$/i, 'ia'],
  ],
  e: [
    [/(kn|l|w)ife$/i, '$1ives'],
    [/(hive)$/i, '$1s'],
    [/([m|l])ouse$/i, '$1ice'],
    [/([m|l])ice$/i, '$1ice'],
  ],
  f: [
    [/^(dwar|handkerchie|hoo|scar|whar)f$/i, '$1ves'],
    [/^((?:ca|e|ha|(?:our|them|your)?se|she|wo)l|lea|loa|shea|thie)f$/i, '$1ves'],
  ],
  i: [[/(octop|vir)i$/i, '$1i']],
  m: [[/([ti])um$/i, '$1a']],
  n: [[/^(oxen)$/i, '$1']],
  o: [[/(al|ad|at|er|et|ed)o$/i, '$1oes']],
  s: [
    [/(ax|test)is$/i, '$1es'],
    [/(alias|status)$/i, '$1es'],
    [/sis$/i, 'ses'],
    [/(bu)s$/i, '$1ses'],
    [/(sis)$/i, 'ses'],
    [/^(?!talis|.*hu)(.*)man$/i, '$1men'],
    [/(octop|vir|radi|nucle|fung|cact|stimul)us$/i, '$1i'],
  ],
  x: [
    [/(matr|vert|ind|cort)(ix|ex)$/i, '$1ices'],
    [/^(ox)$/i, '$1en'],
  ],
  y: [[/([^aeiouy]|qu)y$/i, '$1ies']],
  z: [[/(quiz)$/i, '$1zes']],
}
export default suffixes
