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
