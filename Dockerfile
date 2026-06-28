FROM python:3.11-slim
RUN pip install --no-cache-dir hermes-agent
CMD sh -c 'mkdir -p $HOME/.hermes && echo "DEEPSEEK_API_KEY=$DEEPSEEK_API_KEY" > $HOME/.hermes/.env && cat > $HOME/.hermes/config.yaml << END
model:
  default: deepseek/deepseek-chat
  provider: deepseek
  base_url: https://api.deepseek.com/v1
platforms:
  api_server:
    enabled: true
    host: 0.0.0.0
    port: 8642
END
&& hermes gateway run'
