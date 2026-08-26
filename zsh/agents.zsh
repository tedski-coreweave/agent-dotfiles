# Agent harness environment. Deployed to ~/.oh-my-zsh/custom/agents.zsh
# by ~/src/agent-dotfiles/install.sh (oh-my-zsh auto-sources custom/*.zsh).

# Netskope TLS interception: node-based tooling needs the corporate CA
# bundle or HTTPS breaks. Refresh the bundle with ~/.pi/refresh-netskope-ca.sh.
#
# Only export when the bundle is actually readable. Node warns on every
# process start if NODE_EXTRA_CA_CERTS points at a missing file, which is
# the normal state on a machine without Netskope.
if [[ -r "$HOME/.pi/netskope-ca.pem" ]]; then
  export NODE_EXTRA_CA_CERTS="$HOME/.pi/netskope-ca.pem"
fi

# Firecrawl API key for agent tooling (vault firecrawl scripts). The secret
# lives in 1Password; only the reference lives here. Resolved once per
# interactive shell and inherited by everything launched from it. Guarded so
# a missing op, a locked vault, or an offline machine degrades to "var
# unset" instead of a broken shell startup.
if [[ -z "${FIRECRAWL_API_KEY:-}" ]] && command -v op >/dev/null 2>&1; then
  export FIRECRAWL_API_KEY="$(op read 'op://Employee/Firecrawl API Key/credential' 2>/dev/null)"
  [[ -n "$FIRECRAWL_API_KEY" ]] || unset FIRECRAWL_API_KEY
fi
