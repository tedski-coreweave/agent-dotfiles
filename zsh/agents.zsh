# Agent harness environment. Deployed to ~/.oh-my-zsh/custom/agents.zsh
# by ~/src/agent-dotfiles/install.sh (oh-my-zsh auto-sources custom/*.zsh).

# Netskope TLS interception: node-based tooling needs the corporate CA
# bundle or HTTPS breaks. Refresh the bundle with ~/.pi/refresh-netskope-ca.sh.
export NODE_EXTRA_CA_CERTS="$HOME/.pi/netskope-ca.pem"
