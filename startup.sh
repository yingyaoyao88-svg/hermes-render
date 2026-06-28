#!/bin/bash
set -e

# Set default config if not present
CONFIG_DIR="\$HOME/.hermes"
mkdir -p "\$CONFIG_DIR"

# Write config.yaml if it doesn't exist
if [ ! -f "\$CONFIG_DIR/config.yaml" ]; then
  cat > "\$CONFIG_DIR/config.yaml" << 'CONFIGEOF'
model:
  default: deepseek/deepseek-chat
  provider: deepseek
  base_url: https://api.deepseek.com/v1
platforms:
  api_server:
    enabled: true
    host: 0.0.0.0
    port: 8642
    key: ${API_SERVER_KEY}
    cors_origins: ${API_SERVER_CORS_ORIGINS}
CONFIGEOF
fi

# Ensure .env file with DeepSeek key
if [ ! -f "\$CONFIG_DIR/.env" ]; then
  echo "DEEPSEEK_API_KEY=\$DEEPSEEK_API_KEY" > "\$CONFIG_DIR/.env"
fi

exec hermes gateway run
