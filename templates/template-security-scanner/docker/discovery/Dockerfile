FROM projectdiscovery/katana@sha256:20c42a63b71f0c2e95cb02d973e8887e70ad65ea9cb818183f163143275e746c

RUN addgroup -g 10001 scanner \
    && adduser -D -u 10001 -G scanner scanner \
    && mkdir -p /workspace \
    && chown scanner:scanner /workspace \
    && chmod 700 /workspace \
    && ln -s "$(command -v chromium-browser || command -v chromium)" /usr/local/bin/scanner-chromium

ENV HOME=/workspace
USER 10001:10001
WORKDIR /workspace
ENTRYPOINT []
CMD ["sleep", "infinity"]
