FROM node:alpine as builder

RUN npm install -g inngest-cli@latest

FROM node:alpine as inngest

COPY --from=builder /usr/local/lib/node_modules /usr/local/lib/node_modules
COPY --from=builder /usr/local/bin /usr/local/bin

EXPOSE 8288

ENTRYPOINT ["inngest-cli", "dev"]
