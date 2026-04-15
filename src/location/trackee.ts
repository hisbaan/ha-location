import { getHaConnection, getTrackedEntity } from "../db/repository";
import { getLocationSnapshot } from "../home-assistant/client";
import { decryptSecret } from "../security/crypto";

export async function fetchTrackeeSnapshot(discordUserId: string) {
  const [connection, trackedEntity] = await Promise.all([
    getHaConnection(discordUserId),
    getTrackedEntity(discordUserId),
  ]);

  if (!connection) {
    throw new Error("Trackee has not registered Home Assistant.");
  }

  if (!trackedEntity) {
    throw new Error("Trackee has not selected an entity yet.");
  }

  const token = await decryptSecret(connection.encryptedAccessToken);
  const snapshot = await getLocationSnapshot(connection.haBaseUrl, token, trackedEntity.entityId);

  return {
    connection,
    trackedEntity,
    snapshot,
  };
}
