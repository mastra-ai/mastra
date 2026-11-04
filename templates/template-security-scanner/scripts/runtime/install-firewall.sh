#!/bin/sh
set -eu
test "$#" = 2 || test "$#" = 3
case "$1" in ''|*[!0-9.]*) exit 77 ;; esac
case "$2" in ''|*[!0-9]*) exit 77 ;; esac
test "$2" -ge 8080
test "$2" -le 8111
ports="$2"
if test "$#" = 3; then
  case "$3" in ''|*[!0-9]*) exit 77 ;; esac
  test "$2" -eq 8080
  test "$3" -eq 8081
  ports="$2-$3"
fi
nft -f - <<EOF
table inet scanner {
  chain output {
    type filter hook output priority 0; policy drop;
    ct state established,related accept
    ip daddr $1 tcp dport $ports accept
    oifname "lo" ip daddr 127.0.0.1 meta skuid 10001 tcp dport 9222 accept
    oifname "lo" ip daddr 127.0.0.1 meta skuid 10001 tcp dport 40000-40031 counter accept
    counter drop
  }
  chain input {
    type filter hook input priority 0; policy drop;
    ct state established,related accept
    iifname "lo" ip saddr 127.0.0.1 tcp dport 9222 accept
    iifname "lo" ip saddr 127.0.0.1 tcp dport 40000-40031 counter accept
    counter drop
  }
}
EOF
nft -j list ruleset
