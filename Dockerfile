FROM python:3.11-slim
RUN pip install --no-cache-dir hermes-agent
RUN mkdir -p /opt/data && \n    echo "model:" > /opt/data/config.yaml && \n    echo "  default: deepseek/deepseek-chat" >> /opt/data/config.yaml && \n    echo "  provider: deepseek" >> /opt/data/config.yaml && \n    echo "  base_url: https://api.deepseek.com/v1" >> /opt/data/config.yaml && \n    echo "platforms:" >> /opt/data/config.yaml && \n    echo "  api_server:" >> /opt/data/config.yaml && \n    echo "    enabled: true" >> /opt/data/config.yaml && \n    echo "    host: 0.0.0.0" >> /opt/data/config.yaml && \n    echo "    port: 8642" >> /opt/data/config.yaml
EXPOSE 8642
CMD sh -c 'echo "DEEPSEEK_API_KEY=$DEEPSEEK_API_KEY" > /opt/data/.env && exec hermes gateway run'
