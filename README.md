# ha-location-bot

Discord bot for sharing Home Assistant-backed location with per-viewer access control.

> [!CAUTION]
> This bot was mostly-vibe coded. I have reviewed the code, but not very thorougly and thus could have missed something. Use at your own risk.

## What It Does

- Users register their own Home Assistant instance and token privately
- Each user chooses which HA `person.*` or `device_tracker.*` entity represents them
- Users grant other Discord users either `ephemeral` or `public` access
- `/whereis` with `visibility:auto` uses the highest allowed visibility

## Setup

You need a Discord application and bot token.

Required values:

- `DISCORD_BOT_TOKEN`
- `DISCORD_APPLICATION_ID`
- `ENCRYPTION_KEY`

Generate an encryption key with:

```bash
openssl rand -base64 32
```

## Environment

Create a `.env` file next to `compose.yaml`.

Example:

```env
DISCORD_BOT_TOKEN=your-bot-token
DISCORD_APPLICATION_ID=your-application-id
DISCORD_GUILD_ID=optionally-your-server-id
ENCRYPTION_KEY=base64-encoded-32-byte-key
MAP_TILE_URL_TEMPLATE=https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}.png?api_key={apiKey}
MAP_TILE_API_KEY=your-stadia-key
MAP_TILE_USER_AGENT=ha-location-bot/0.1
MAP_DEFAULT_ZOOM=18
```

Map tile notes:

- `MAP_TILE_URL_TEMPLATE` must contain `{z}`, `{x}`, and `{y}`
- if it contains `{apiKey}`, also set `MAP_TILE_API_KEY`

### Alternative Maps

There are some other map options. By default, the bot will use OpenStreeMaps. That can be a little noisy-looking so I prefer to use Stadia Maps or Map Tiler.

```env
MAP_TILE_URL_TEMPLATE=https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}.png?api_key={apiKey}
MAP_TILE_API_KEY=your-stadia-key
```

```env
MAP_TILE_URL_TEMPLATE=https://api.maptiler.com/maps/streets-v2/256/{z}/{x}/{y}.png?key={apiKey}
MAP_TILE_API_KEY=your-maptiler-key
```

## Compose

See [compose.yaml](./compose.yaml):

```yaml
services:
  bot:
    image: ghcr.io/hisbaan/ha-location-bot:latest
    restart: unless-stopped
    environment:
      DATABASE_PATH: /app/data/ha-location-bot.db
    volumes:
      - ./data:/app/data
```

## Register Discord Commands

Slash commands are not created automatically. Register them once after setting your environment:

If you are running from source locally:

```bash
bun run commands:register
```

If you are using only the container image, run the registration command inside the container image with your `.env` loaded. One simple way is:

```bash
docker compose run --rm bot bun run src/scripts/register-commands.ts
```

- if `DISCORD_GUILD_ID` is set, commands are registered only to that server
- otherwise they are registered globally


## Contributing

Development and contribution instructions live in `CONTRIBUTING.md`.
