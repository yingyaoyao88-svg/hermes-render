FROM python:3.11-slim
RUN pip install --no-cache-dir hermes-agent
RUN mkdir -p /root/.hermes && echo "model:" > /root/.hermes/config.yaml && echo "  default: deepseek/deepseek-chat" >> /root/.hermes/config.yaml && echo "  provider: deepseek" >> /root/.hermes/config.yaml && echo "  base_url: https://api.deepseek.com/v1" >> /root/.hermes/config.yaml && echo "platforms:" >> /root/.hermes/config.yaml && echo "  api_server:" >> /root/.hermes/config.yaml && echo "    enabled: true" >> /root/.hermes/config.yaml && echo "    host: 0.0.0.0" >> /root/.hermes/config.yaml && echo "    port: 8642" >> /root/.hermes/config.yaml
EXPOSE 8642
CMD sh -c 'echo "DEEPSEEK_API_KEY=$DEEPSEEK_API_KEY" > /root/.hermes/.env && exec hermes gateway run'
