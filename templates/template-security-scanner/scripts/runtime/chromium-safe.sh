#!/bin/sh
set -eu
first=true
for argument do
  if "$first"; then set --; first=false; fi
  case "$argument" in
    -[!-]*) argument="--${argument#-}" ;;
  esac
  case "$argument" in
    --no-sandbox|--no-sandbox=*|--ignore-certificate-errors|--ignore-certificate-errors=*|--remote-allow-origins|--remote-allow-origins=*|--remote-debugging-port=*|--remote-debugging-address=*) continue ;;
    --disable-setuid-sandbox|--disable-setuid-sandbox=*|--disable-seccomp-filter-sandbox|--disable-seccomp-filter-sandbox=*|--disable-namespace-sandbox|--disable-namespace-sandbox=*|--disable-web-security|--disable-web-security=*|--allow-running-insecure-content|--allow-running-insecure-content=*|--allow-insecure-localhost|--allow-insecure-localhost=*|--ignore-certificate-errors-spki-list|--ignore-certificate-errors-spki-list=*|--single-process|--single-process=*|--no-zygote|--no-zygote=*|--renderer-cmd-prefix|--renderer-cmd-prefix=*|--utility-cmd-prefix|--utility-cmd-prefix=*|--gpu-launcher|--gpu-launcher=*) exit 77 ;;
    *) set -- "$@" "$argument" ;;
  esac
done
test "$#" -le 128
exec /usr/local/bin/scanner-chromium "$@" --remote-debugging-port=9222 --remote-debugging-address=127.0.0.1
