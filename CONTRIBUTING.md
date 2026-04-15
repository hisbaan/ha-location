# Contributing

## Local Development

1. Install dependencies:

```bash
bun install
```

2. Create `.env` from `.env.example`

3. Generate an encryption key for `ENCRYPTION_KEY`:

```bash
openssl rand -base64 32
```

4. Run the bot:

```bash
bun run dev
```

## Useful Commands

Typecheck:

```bash
bun run check
```

Generate a migration:

```bash
bun run db:generate
```

Apply migrations locally:

```bash
bun run db:migrate
```

Register slash commands:

```bash
bun run commands:register
```

## Discord Command Registration

- set `DISCORD_GUILD_ID` to register commands to one test server for fast iteration
- leave `DISCORD_GUILD_ID` unset to register commands globally

## Docker Development

Build the image locally:

```bash
docker build -t ha-location-bot:local .
```

Run with Compose:

```bash
docker compose up -d
```

## Release Images

Publishing a GitHub release triggers the workflow in `.github/workflows/release-image.yml`, which builds and pushes a container image to GHCR.
