#!/bin/bash
# Export the Netskope TLS-inspection CAs from the macOS System keychain into a
# PEM bundle Node can use via NODE_EXTRA_CA_CERTS.
#
# Node ships its own CA store and ignores macOS system trust, so MDM-installed
# Netskope roots are invisible to it and intercepted TLS fails with
# SELF_SIGNED_CERT_IN_CHAIN. curl works because it uses system trust.
# Re-run this if Netskope rotates its CA.
#
# The destination is only replaced after a valid bundle is in hand. A failed
# keychain query or a run on a machine without Netskope leaves the previous
# bundle intact, because destroying a working bundle breaks every Node process.
set -euo pipefail
OUT="${1:-$HOME/.pi/netskope-ca.pem}"

mkdir -p "$(dirname "$OUT")"
TMP="$(mktemp "${TMPDIR:-/tmp}/netskope-ca.XXXXXX")"
trap 'rm -f "$TMP"' EXIT

{
  security find-certificate -a -c netskope  -p /Library/Keychains/System.keychain 2>/dev/null || true
  security find-certificate -a -c goskope   -p /Library/Keychains/System.keychain 2>/dev/null || true
  security find-certificate -a -c certadmin -p /Library/Keychains/System.keychain 2>/dev/null || true
} | awk '/BEGIN CERT/,/END CERT/' > "$TMP"

n=$(grep -c 'BEGIN CERTIFICATE' "$TMP" || true)
if [ "$n" -eq 0 ]; then
  echo "No Netskope CAs found; is Netskope installed?" >&2
  if [ -s "$OUT" ]; then
    echo "Left the existing bundle at $OUT untouched." >&2
  fi
  exit 1
fi

# Verify the bundle parses before trusting it.
if command -v openssl >/dev/null 2>&1; then
  if ! openssl x509 -in "$TMP" -noout >/dev/null 2>&1; then
    echo "Extracted data is not a valid certificate; $OUT unchanged." >&2
    exit 1
  fi
fi

# Atomic replace: same filesystem as the destination, so mv cannot half-write.
FINAL_TMP="$OUT.tmp.$$"
cp "$TMP" "$FINAL_TMP"
mv -f "$FINAL_TMP" "$OUT"

echo "Wrote $n cert(s) to $OUT"
