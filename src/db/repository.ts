import { and, eq, gt, sql } from "drizzle-orm";

import { db } from "./index";
import {
  haConnections,
  liveLocationMessages,
  trackedEntities,
  viewerPermissions,
  type ViewerAccessTier,
} from "./schema";

function now() {
  return sql`CURRENT_TIMESTAMP`;
}

export async function getHaConnection(discordUserId: string) {
  return db.query.haConnections.findFirst({
    where: { discordUserId },
  });
}

export async function upsertHaConnection(input: {
  discordUserId: string;
  haBaseUrl: string;
  encryptedAccessToken: string;
  lastValidatedAt: string;
}) {
  await db
    .insert(haConnections)
    .values({
      discordUserId: input.discordUserId,
      haBaseUrl: input.haBaseUrl,
      encryptedAccessToken: input.encryptedAccessToken,
      lastValidatedAt: input.lastValidatedAt,
    })
    .onConflictDoUpdate({
      target: haConnections.discordUserId,
      set: {
        haBaseUrl: input.haBaseUrl,
        encryptedAccessToken: input.encryptedAccessToken,
        lastValidatedAt: input.lastValidatedAt,
        updatedAt: now(),
      },
    });
}

export async function deleteHaConnection(discordUserId: string) {
  await db.delete(haConnections).where(eq(haConnections.discordUserId, discordUserId));
}

export async function getTrackedEntity(discordUserId: string) {
  return db.query.trackedEntities.findFirst({
    where: { discordUserId },
  });
}

export async function upsertTrackedEntity(input: {
  discordUserId: string;
  entityId: string;
  friendlyName: string;
  entityDomain: string;
}) {
  await db
    .insert(trackedEntities)
    .values(input)
    .onConflictDoUpdate({
      target: trackedEntities.discordUserId,
      set: {
        entityId: input.entityId,
        friendlyName: input.friendlyName,
        entityDomain: input.entityDomain,
        updatedAt: now(),
      },
    });
}

export async function deleteTrackedEntity(discordUserId: string) {
  await db.delete(trackedEntities).where(eq(trackedEntities.discordUserId, discordUserId));
}

export async function getViewerPermission(ownerDiscordUserId: string, viewerDiscordUserId: string) {
  return db.query.viewerPermissions.findFirst({
    where: {
      ownerDiscordUserId,
      viewerDiscordUserId,
    },
  });
}

export async function listViewerPermissions(ownerDiscordUserId: string) {
  return db.query.viewerPermissions.findMany({
    where: { ownerDiscordUserId },
    orderBy: (table, { asc }) => [asc(table.viewerDiscordUserId)],
  });
}

export async function upsertViewerPermission(input: {
  ownerDiscordUserId: string;
  viewerDiscordUserId: string;
  accessTier: ViewerAccessTier;
}) {
  await db
    .insert(viewerPermissions)
    .values(input)
    .onConflictDoUpdate({
      target: [viewerPermissions.ownerDiscordUserId, viewerPermissions.viewerDiscordUserId],
      set: {
        accessTier: input.accessTier,
        updatedAt: now(),
      },
    });
}

export async function deleteViewerPermission(ownerDiscordUserId: string, viewerDiscordUserId: string) {
  await db
    .delete(viewerPermissions)
    .where(
      and(
        eq(viewerPermissions.ownerDiscordUserId, ownerDiscordUserId),
        eq(viewerPermissions.viewerDiscordUserId, viewerDiscordUserId),
      ),
    );
}

export async function createLiveLocationMessage(input: {
  ownerDiscordUserId: string;
  channelId: string;
  guildId: string | null;
  messageId: string;
  createdByDiscordUserId: string;
  createdAt: string;
  expiresAt: string;
}) {
  await db.insert(liveLocationMessages).values({
    ownerDiscordUserId: input.ownerDiscordUserId,
    channelId: input.channelId,
    guildId: input.guildId,
    messageId: input.messageId,
    createdByDiscordUserId: input.createdByDiscordUserId,
    active: true,
    createdAt: input.createdAt,
    expiresAt: input.expiresAt,
    updatedAt: input.createdAt,
  });
}

export async function deactivateLiveLocationMessagesForOwnerInChannel(
  ownerDiscordUserId: string,
  channelId: string,
  updatedAt: string,
) {
  await db
    .update(liveLocationMessages)
    .set({
      active: false,
      updatedAt,
    })
    .where(
      and(
        eq(liveLocationMessages.ownerDiscordUserId, ownerDiscordUserId),
        eq(liveLocationMessages.channelId, channelId),
        eq(liveLocationMessages.active, true),
      ),
    );
}

export async function deactivateAllLiveLocationMessagesForOwner(ownerDiscordUserId: string, updatedAt: string) {
  await db
    .update(liveLocationMessages)
    .set({
      active: false,
      updatedAt,
    })
    .where(
      and(
        eq(liveLocationMessages.ownerDiscordUserId, ownerDiscordUserId),
        eq(liveLocationMessages.active, true),
      ),
    );
}

export async function deactivateLiveLocationMessageById(id: number, updatedAt: string) {
  await db
    .update(liveLocationMessages)
    .set({
      active: false,
      updatedAt,
    })
    .where(eq(liveLocationMessages.id, id));
}

export async function deactivateExpiredLiveLocationMessages(nowIso: string) {
  await db
    .update(liveLocationMessages)
    .set({
      active: false,
      updatedAt: nowIso,
    })
    .where(
      and(
        eq(liveLocationMessages.active, true),
        sql`${liveLocationMessages.expiresAt} <= ${nowIso}`,
      ),
    );
}

export async function listActiveLiveLocationMessages(nowIso: string) {
  return db
    .select()
    .from(liveLocationMessages)
    .where(
      and(
        eq(liveLocationMessages.active, true),
        gt(liveLocationMessages.expiresAt, nowIso),
      ),
    )
    .all();
}

export async function listActiveLiveLocationMessagesForOwnerInChannel(
  ownerDiscordUserId: string,
  channelId: string,
  nowIso: string,
) {
  return db
    .select()
    .from(liveLocationMessages)
    .where(
      and(
        eq(liveLocationMessages.ownerDiscordUserId, ownerDiscordUserId),
        eq(liveLocationMessages.channelId, channelId),
        eq(liveLocationMessages.active, true),
        gt(liveLocationMessages.expiresAt, nowIso),
      ),
    )
    .all();
}
