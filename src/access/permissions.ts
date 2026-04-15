import type { ViewerAccessTier } from "../db/schema";

export type LocationVisibility = "auto" | "ephemeral" | "public";

export type AccessResolution = {
  allowed: boolean;
  ephemeral?: boolean;
  reason?: string;
  tier?: ViewerAccessTier | "owner";
};

export function resolveWhereIsAccess(input: {
  ownerDiscordUserId: string;
  requesterDiscordUserId: string;
  permissionTier: ViewerAccessTier | null;
  requestedVisibility: LocationVisibility;
}): AccessResolution {
  if (input.ownerDiscordUserId === input.requesterDiscordUserId) {
    const ephemeral = input.requestedVisibility === "ephemeral";

    return {
      allowed: true,
      ephemeral,
      tier: "owner",
    };
  }

  if (!input.permissionTier) {
    return {
      allowed: false,
      reason: "You do not have access to this user's location.",
    };
  }

  if (
    input.permissionTier === "ephemeral" &&
    input.requestedVisibility === "public"
  ) {
    return {
      allowed: false,
      reason: "You only have ephemeral access for this user.",
      tier: input.permissionTier,
    };
  }

  if (input.requestedVisibility === "auto") {
    return {
      allowed: true,
      ephemeral: input.permissionTier === "ephemeral",
      tier: input.permissionTier,
    };
  }

  return {
    allowed: true,
    ephemeral: input.requestedVisibility !== "public",
    tier: input.permissionTier,
  };
}
