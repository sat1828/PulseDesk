FROM node:22-alpine AS builder

WORKDIR /app
COPY package.json ./
RUN npm install && npm cache clean --force
COPY tsconfig.json ./
COPY src/ ./src/
COPY scripts/ ./scripts/

FROM node:22-alpine AS runner

RUN apk add --no-cache tini
RUN addgroup -S pulsedesk && adduser -S pulsedesk -G pulsedesk

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/src/ ./src/
COPY --from=builder /app/scripts/ ./scripts/

RUN npm install -g tsx

USER pulsedesk

EXPOSE 3001

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["tsx", "src/server.ts"]
