import { sql } from "drizzle-orm";
import { integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const haConnections = sqliteTable("ha_connections", {
  discordUserId: text("discord_user_id").primaryKey(),
  haBaseUrl: text("ha_base_url").notNull(),
  encryptedAccessToken: text("encrypted_access_token").notNull(),
  authType: text("auth_type", { enum: ["long_lived_token"] })
    .notNull()
    .default("long_lived_token"),
  lastValidatedAt: text("last_validated_at").notNull(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const trackedEntities = sqliteTable("tracked_entities", {
  discordUserId: text("discord_user_id").primaryKey(),
  entityId: text("entity_id").notNull(),
  friendlyName: text("friendly_name").notNull(),
  entityDomain: text("entity_domain").notNull(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export type ViewerAccessTier = "ephemeral" | "public";

export const viewerPermissions = sqliteTable(
  "viewer_permissions",
  {
    ownerDiscordUserId: text("owner_discord_user_id").notNull(),
    viewerDiscordUserId: text("viewer_discord_user_id").notNull(),
    accessTier: text("access_tier").$type<ViewerAccessTier>().notNull(),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    primaryKey({
      columns: [table.ownerDiscordUserId, table.viewerDiscordUserId],
    }),
  ],
);

export const liveLocationMessages = sqliteTable("live_location_messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ownerDiscordUserId: text("owner_discord_user_id").notNull(),
  channelId: text("channel_id").notNull(),
  guildId: text("guild_id"),
  messageId: text("message_id").notNull(),
  createdByDiscordUserId: text("created_by_discord_user_id").notNull(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull(),
  expiresAt: text("expires_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});
