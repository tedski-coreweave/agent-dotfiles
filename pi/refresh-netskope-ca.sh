#!/bin/bash
# Export the Netskope TLS-inspection CAs from the macOS System keychain into a
# PEM bundle Node can use via NODE_EXTRA_CA_CERTS.
#
# Node ships its own CA store and ignores macOS system trust, so MDM-installed
# Netskope roots are invisible to it and intercepted TLS fails with
# SELF_SIGNED_CERT_IN_CHAIN. curl works because it uses system trust.
# Re-run this if Netskope rotates its CA.
set -euo pipefail
OUT="${1:-$HOME/.pi/netskope-ca.pem}"
{
  security find-certificate -a -c netskope  -p /Library/Keychains/System.keychain 2>/dev/null || true
  security find-certificate -a -c goskope   -p /Library/Keychains/System.keychain 2>/dev/null || true
  security find-certificate -a -c certadmin -p /Library/Keychains/System.keychain 2>/dev/null || true
} | awk '/BEGIN CERT/,/END CERT/' > "$OUT"
n=$(grep -c 'BEGIN CERTIFICATE' "$OUT" || true)
[ "$n" -gt 0 ] || { echo "No Netskope CAs found; is Netskope installed?" >&2; exit 1; }
echo "Wrote $n cert(s) to $OUT"
