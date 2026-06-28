FROM python:3.11-slim

# Install hermes
RUN pip install --no-cache-dir hermes-agent

# Pre-create config directory and config.yaml
RUN mkdir -p /root/.hermes &&     printf 'model:
  default: deepseek/deepseek-chat
  provider: deepseek
  base_url: https://api.deepseek.com/v1
' > /root/.hermes/config.yaml

EXPOSE 8642

CMD ["hermes", "gateway", "run"]
