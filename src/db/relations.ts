import { defineRelations } from "drizzle-orm/relations";

import * as schema from "./schema";

export const relations = defineRelations(schema, ({ haConnections, trackedEntities, one }) => ({
  haConnections: {
    trackedEntity: one.trackedEntities({
      from: haConnections.discordUserId,
      to: trackedEntities.discordUserId,
    }),
  },
  trackedEntities: {
    haConnection: one.haConnections({
      from: trackedEntities.discordUserId,
      to: haConnections.discordUserId,
    }),
  },
}));
