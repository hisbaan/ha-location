import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from "discord.js";

import type { LocationSnapshot } from "../home-assistant/client";
import { renderStaticMap } from "../maps/static-map";

function appleMapsUrl(latitude: number, longitude: number) {
  return `https://maps.apple.com/?ll=${latitude},${longitude}&q=${latitude},${longitude}`;
}

function googleMapsUrl(latitude: number, longitude: number) {
  return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
}

export function buildLocationSnapshotKey(snapshot: LocationSnapshot) {
  return JSON.stringify({
    latitude: snapshot.latitude.toFixed(5),
    longitude: snapshot.longitude.toFixed(5),
    state: snapshot.state,
    locationSummary: snapshot.locationSummary ?? null,
  });
}

export async function buildWhereIsMessagePayload(input: {
  snapshot: LocationSnapshot;
  displayName: string;
  avatarUrl: string | null;
}) {
  const mapBuffer = await renderStaticMap({
    latitude: input.snapshot.latitude,
    longitude: input.snapshot.longitude,
    label: `${input.displayName} is here`,
    avatarUrl: input.avatarUrl,
  });

  const attachment = new AttachmentBuilder(mapBuffer, { name: "location.png" });
  const mapLinks = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setLabel("Open in Apple Maps")
      .setStyle(ButtonStyle.Link)
      .setURL(appleMapsUrl(input.snapshot.latitude, input.snapshot.longitude)),
    new ButtonBuilder()
      .setLabel("Open in Google Maps")
      .setStyle(ButtonStyle.Link)
      .setURL(googleMapsUrl(input.snapshot.latitude, input.snapshot.longitude)),
  );

  const embed = new EmbedBuilder()
    .setTitle(`Where is ${input.displayName}?`)
    .setDescription(
      [
        `Entity: \`${input.snapshot.friendlyName}\` (\`${input.snapshot.entityId}\`)`,
        input.snapshot.locationSummary ? `Location: \`${input.snapshot.locationSummary}\`` : undefined,
        `State: \`${input.snapshot.state}\``,
        `Updated: <t:${Math.floor(new Date(input.snapshot.lastUpdated).getTime() / 1000)}:R>`,
      ]
        .filter((line): line is string => Boolean(line))
        .join("\n"),
    )
    .setImage("attachment://location.png")
    .setFooter({
      text: `${input.snapshot.latitude.toFixed(5)}, ${input.snapshot.longitude.toFixed(5)}`,
    });

  return {
    embeds: [embed],
    files: [attachment],
    components: [mapLinks],
  };
}
