import "dotenv/config";

import { z } from "zod";

const envSchema = z.object({
  DISCORD_BOT_TOKEN: z.string().min(1, "DISCORD_BOT_TOKEN is required"),
  DISCORD_APPLICATION_ID: z.string().min(1, "DISCORD_APPLICATION_ID is required"),
  DISCORD_GUILD_ID: z.string().min(1).optional(),
  DATABASE_PATH: z.string().default("./data/ha-location-bot.db"),
  ENCRYPTION_KEY: z.string().min(1, "ENCRYPTION_KEY is required"),
  MAP_TILE_URL_TEMPLATE: z
    .string()
    .min(1)
    .refine(
      (value) => value.includes("{z}") && value.includes("{x}") && value.includes("{y}"),
      "MAP_TILE_URL_TEMPLATE must include {z}, {x}, and {y}",
    )
    .default("https://tile.openstreetmap.org/{z}/{x}/{y}.png"),
  MAP_TILE_API_KEY: z.string().optional(),
  MAP_TILE_USER_AGENT: z.string().default("ha-location-bot/0.1"),
  MAP_DEFAULT_ZOOM: z.coerce.number().int().min(1).max(20).default(14),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const message = parsed.error.issues
    .map((issue) => `${issue.path.join(".") || "env"}: ${issue.message}`)
    .join("\n");
  throw new Error(`Invalid environment configuration:\n${message}`);
}

export const env = {
  discordBotToken: parsed.data.DISCORD_BOT_TOKEN,
  discordApplicationId: parsed.data.DISCORD_APPLICATION_ID,
  discordGuildId: parsed.data.DISCORD_GUILD_ID,
  databasePath: parsed.data.DATABASE_PATH,
  encryptionKey: parsed.data.ENCRYPTION_KEY,
  mapTileUrlTemplate: parsed.data.MAP_TILE_URL_TEMPLATE,
  mapTileApiKey: parsed.data.MAP_TILE_API_KEY,
  mapTileUserAgent: parsed.data.MAP_TILE_USER_AGENT,
  mapDefaultZoom: parsed.data.MAP_DEFAULT_ZOOM,
};
