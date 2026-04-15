FROM oven/bun:1.3.2 AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV DATABASE_PATH=/app/data/ha-location-bot.db

COPY package.json bun.lock tsconfig.json drizzle.config.ts ./
RUN bun install --frozen-lockfile --production

COPY src ./src
COPY drizzle ./drizzle

RUN mkdir -p /app/data

CMD ["bun", "run", "start"]
