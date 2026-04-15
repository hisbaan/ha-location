import type { Client, User } from "discord.js";

import {
  deactivateExpiredLiveLocationMessages,
  deactivateLiveLocationMessageById,
  getViewerPermission,
  listActiveLiveLocationMessages,
} from "../db/repository";
import { fetchTrackeeSnapshot } from "./trackee";
import { buildLocationSnapshotKey, buildWhereIsMessagePayload } from "./whereis-message";

const LIVE_LOCATION_POLL_INTERVAL_MS = 60_000;

function displayNameForUser(user: User) {
  return user.globalName ?? user.username;
}

function userAvatarPngUrl(user: User) {
  return user.displayAvatarURL({ extension: "png", size: 128 }) || null;
}

function nowISO() {
  return new Date().toISOString();
}

async function hasPublicAccess(ownerDiscordUserId: string, viewerDiscordUserId: string) {
  if (ownerDiscordUserId === viewerDiscordUserId) {
    return true;
  }

  const permission = await getViewerPermission(ownerDiscordUserId, viewerDiscordUserId);
  return permission?.accessTier === "public";
}

export function startLiveMessageUpdater(client: Client) {
  const lastSnapshotKeyByOwner = new Map<string, string>();
  let pollInFlight = false;

  const poll = async () => {
    if (pollInFlight) {
      return;
    }

    pollInFlight = true;

    try {
      const startedAt = nowISO();
      await deactivateExpiredLiveLocationMessages(startedAt);
      const bindings = await listActiveLiveLocationMessages(startedAt);

      const bindingsByOwner = new Map<string, typeof bindings>();
      for (const binding of bindings) {
        const group = bindingsByOwner.get(binding.ownerDiscordUserId);
        if (group) {
          group.push(binding);
        } else {
          bindingsByOwner.set(binding.ownerDiscordUserId, [binding]);
        }
      }

      for (const [ownerDiscordUserId, ownerBindings] of bindingsByOwner) {
        try {
          const activeBindings = [];

          for (const binding of ownerBindings) {
            if (await hasPublicAccess(binding.ownerDiscordUserId, binding.createdByDiscordUserId)) {
              activeBindings.push(binding);
              continue;
            }

            await deactivateLiveLocationMessageById(binding.id, nowISO());
          }

          if (activeBindings.length === 0) {
            continue;
          }

          const [{ snapshot }, user] = await Promise.all([
            fetchTrackeeSnapshot(ownerDiscordUserId),
            client.users.fetch(ownerDiscordUserId),
          ]);

          const snapshotKey = buildLocationSnapshotKey(snapshot);
          const previousSnapshotKey = lastSnapshotKeyByOwner.get(ownerDiscordUserId);

          if (previousSnapshotKey === snapshotKey) {
            continue;
          }

          lastSnapshotKeyByOwner.set(ownerDiscordUserId, snapshotKey);

          const payload = await buildWhereIsMessagePayload({
            snapshot,
            displayName: displayNameForUser(user),
            avatarUrl: userAvatarPngUrl(user),
          });

          for (const binding of activeBindings) {
            try {
              const channel = await client.channels.fetch(binding.channelId);
              if (!channel?.isTextBased()) {
                await deactivateLiveLocationMessageById(binding.id, nowISO());
                continue;
              }

              const message = await channel.messages.fetch(binding.messageId);
              await message.edit(payload);
            } catch {
              await deactivateLiveLocationMessageById(binding.id, nowISO());
            }
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          console.error(`Live update failed for owner ${ownerDiscordUserId}: ${message}`);
        }
      }
    } finally {
      pollInFlight = false;
    }
  };

  void poll();
  return setInterval(() => {
    void poll();
  }, LIVE_LOCATION_POLL_INTERVAL_MS);
}
