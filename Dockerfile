FROM python:3.11-slim
RUN pip install --no-cache-dir hermes-agent
COPY startup.sh /startup.sh
RUN chmod +x /startup.sh
CMD ["/startup.sh"]
