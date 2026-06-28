FROM nousresearch/hermes-agent:latest

# Pre-create config files at build time
RUN mkdir -p /opt/data &&     printf 'model:
  default: deepseek/deepseek-chat
  provider: deepseek
  base_url: https://api.deepseek.com/v1
' > /opt/data/config.yaml

EXPOSE 8642

CMD ["hermes", "gateway", "run"]
