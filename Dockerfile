FROM python:3.11-slim
RUN pip install --no-cache-dir hermes-agent
RUN mkdir -p /root/.hermes &&     printf 'model:
  default: deepseek/deepseek-chat
  provider: deepseek
  base_url: https://api.deepseek.com/v1
platforms:
  api_server:
    enabled: true
    host: 0.0.0.0
    port: 8642
' > /root/.hermes/config.yaml
EXPOSE 8642
CMD sh -c 'echo "DEEPSEEK_API_KEY=$DEEPSEEK_API_KEY" > /root/.hermes/.env && exec hermes gateway run'
