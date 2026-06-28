FROM python:3.11-slim
RUN pip install --no-cache-dir hermes-agent
CMD ["hermes", "gateway", "run"]
