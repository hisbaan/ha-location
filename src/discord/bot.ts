import {
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  Client,
  Events,
  GatewayIntentBits,
  type InteractionDeferReplyOptions,
  type InteractionReplyOptions,
  LabelBuilder,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  type Interaction,
  type User,
} from "discord.js";

import { resolveWhereIsAccess, type LocationVisibility } from "../access/permissions";
import {
  deleteHaConnection,
  deactivateAllLiveLocationMessagesForOwner,
  deactivateLiveLocationMessagesForOwnerInChannel,
  deleteTrackedEntity,
  deleteViewerPermission,
  createLiveLocationMessage,
  getHaConnection,
  getTrackedEntity,
  getViewerPermission,
  listActiveLiveLocationMessagesForOwnerInChannel,
  listViewerPermissions,
  upsertHaConnection,
  upsertTrackedEntity,
  upsertViewerPermission,
} from "../db/repository";
import type { ViewerAccessTier } from "../db/schema";
import { listDiscoverableEntities, validateHomeAssistantConnection } from "../home-assistant/client";
import { startLiveMessageUpdater } from "../location/live-message-updater";
import { fetchTrackeeSnapshot } from "../location/trackee";
import { buildWhereIsMessagePayload } from "../location/whereis-message";
import { decryptSecret, encryptSecret } from "../security/crypto";
import {
  REGISTER_HA_BASE_URL_ID,
  REGISTER_HA_MODAL_ID,
  REGISTER_HA_TOKEN_ID,
} from "./commands";

function displayNameForUser(user: User) {
  return user.globalName ?? user.username;
}

function buildRegisterModal() {
  const modal = new ModalBuilder().setCustomId(REGISTER_HA_MODAL_ID).setTitle("Register Home Assistant");

  const baseUrlInput = new TextInputBuilder()
    .setCustomId(REGISTER_HA_BASE_URL_ID)
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("https://homeassistant.example.com")
    .setRequired(true);

  const tokenInput = new TextInputBuilder()
    .setCustomId(REGISTER_HA_TOKEN_ID)
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder("Paste your Home Assistant token")
    .setRequired(true);

  modal.addLabelComponents(
    new LabelBuilder()
      .setLabel("Home Assistant base URL")
      .setTextInputComponent(baseUrlInput),
    new LabelBuilder()
      .setLabel("Long-lived access token")
      .setTextInputComponent(tokenInput),
  );

  return modal;
}

function userAvatarPngUrl(user: User) {
  return user.displayAvatarURL({ extension: "png", size: 128 }) || null;
}

function ephemeralReplyOptions(): InteractionReplyOptions {
  return { flags: MessageFlags.Ephemeral };
}

function ephemeralDeferOptions(): InteractionDeferReplyOptions {
  return { flags: MessageFlags.Ephemeral };
}

async function requireConnection(discordUserId: string) {
  const connection = await getHaConnection(discordUserId);
  if (!connection) {
    throw new Error("You have not registered Home Assistant yet. Use /register-ha first.");
  }

  return {
    connection,
    token: await decryptSecret(connection.encryptedAccessToken),
  };
}

async function handleAutocomplete(interaction: AutocompleteInteraction) {
  if (interaction.commandName !== "entity") {
    return;
  }

  const focusedOption = interaction.options.getFocused(true);
  if (focusedOption.name !== "entity-id") {
    return;
  }

  try {
    const { connection, token } = await requireConnection(interaction.user.id);
    const entities = await listDiscoverableEntities(connection.haBaseUrl, token);
    const query = String(focusedOption.value).toLowerCase();

    await interaction.respond(
      entities
        .filter((entity) => {
          if (!query) {
            return true;
          }
          return (
            entity.entityId.toLowerCase().includes(query) || entity.friendlyName.toLowerCase().includes(query)
          );
        })
        .slice(0, 25)
        .map((entity) => ({
          name: [
            entity.friendlyName,
            entity.locationSummary,
            entity.hasCoordinates ? undefined : "no coords",
          ]
            .filter((value) => value && value.length > 0)
            .join(" • ")
            .slice(0, 100),
          value: entity.entityId,
        })),
    );
  } catch {
    await interaction.respond([]);
  }
}

async function handleRegisterHa(interaction: ChatInputCommandInteraction) {
  await interaction.showModal(buildRegisterModal());
}

async function handleRegisterModal(interaction: Interaction) {
  if (!interaction.isModalSubmit() || interaction.customId !== REGISTER_HA_MODAL_ID) {
    return false;
  }

  await interaction.deferReply(ephemeralDeferOptions());

  try {
    const baseUrl = interaction.fields.getTextInputValue(REGISTER_HA_BASE_URL_ID).trim();
    const token = interaction.fields.getTextInputValue(REGISTER_HA_TOKEN_ID).trim();

    await validateHomeAssistantConnection(baseUrl, token);

    await upsertHaConnection({
      discordUserId: interaction.user.id,
      haBaseUrl: baseUrl.replace(/\/+$/, ""),
      encryptedAccessToken: await encryptSecret(token),
      lastValidatedAt: new Date().toISOString(),
    });

    await interaction.editReply(
      "Home Assistant registration saved. Next, use `/entity set` to pick the entity that represents you.",
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to register Home Assistant.";
    await interaction.editReply(`Registration failed: ${message}`);
  }

  return true;
}

async function handleEntity(interaction: ChatInputCommandInteraction) {
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === "status") {
    const connection = await getHaConnection(interaction.user.id);
    const trackedEntity = await getTrackedEntity(interaction.user.id);

    if (!connection) {
      await interaction.reply({
        content: "You have not registered Home Assistant yet. Use `/register-ha` first.",
        ...ephemeralReplyOptions(),
      });
      return;
    }

    const lines = [
      `HA URL: ${connection.haBaseUrl}`,
      trackedEntity
        ? `Entity: \`${trackedEntity.friendlyName}\` (\`${trackedEntity.entityId}\`)`
        : "Entity: not selected",
    ];

    await interaction.reply({
      content: lines.join("\n"),
      ...ephemeralReplyOptions(),
    });
    return;
  }

  const entityId = interaction.options.getString("entity-id", true);
  await interaction.deferReply(ephemeralDeferOptions());

  try {
    const { connection, token } = await requireConnection(interaction.user.id);
    const entities = await listDiscoverableEntities(connection.haBaseUrl, token);
    const selected = entities.find((entity) => entity.entityId === entityId);

    if (!selected) {
      throw new Error("That entity was not found in your Home Assistant instance.");
    }

    await upsertTrackedEntity({
      discordUserId: interaction.user.id,
      entityId: selected.entityId,
      friendlyName: selected.friendlyName,
      entityDomain: selected.domain,
    });

    const coordSuffix = selected.hasCoordinates ? "" : " It does not currently expose coordinates.";
    await interaction.editReply(
      `Tracking \`${selected.friendlyName}\` (\`${selected.entityId}\`).${coordSuffix}`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to set tracked entity.";
    await interaction.editReply(message);
  }
}

async function handleViewer(interaction: ChatInputCommandInteraction) {
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === "list") {
    const viewers = await listViewerPermissions(interaction.user.id);
    if (viewers.length === 0) {
      await interaction.reply({
        content: "No viewers have been granted access yet.",
        ...ephemeralReplyOptions(),
      });
      return;
    }

    const lines = viewers.map((viewer) => `<@${viewer.viewerDiscordUserId}>: ${viewer.accessTier}`);
    await interaction.reply({
      content: lines.join("\n"),
      ...ephemeralReplyOptions(),
      allowedMentions: { users: [] },
    });
    return;
  }

  const targetUser = interaction.options.getUser("user", true);
  if (targetUser.id === interaction.user.id) {
    await interaction.reply({
      content: "You already control your own location visibility.",
      ...ephemeralReplyOptions(),
    });
    return;
  }

  if (subcommand === "remove") {
    await deleteViewerPermission(interaction.user.id, targetUser.id);
    await interaction.reply({
      content: `Removed location access for ${displayNameForUser(targetUser)}.`,
      ...ephemeralReplyOptions(),
    });
    return;
  }

  const tier = interaction.options.getString("tier", true) as ViewerAccessTier;
  await upsertViewerPermission({
    ownerDiscordUserId: interaction.user.id,
    viewerDiscordUserId: targetUser.id,
    accessTier: tier,
  });

  await interaction.reply({
    content: `Granted ${tier} access to ${displayNameForUser(targetUser)}.`,
    ...ephemeralReplyOptions(),
  });
}

async function handleWhereIs(interaction: ChatInputCommandInteraction) {
  const targetUser = interaction.options.getUser("user", true);
  const requestedVisibility =
    (interaction.options.getString("visibility") as LocationVisibility | null) ?? "auto";

  const permission =
    targetUser.id === interaction.user.id
      ? null
      : await getViewerPermission(targetUser.id, interaction.user.id);

  const resolution = resolveWhereIsAccess({
    ownerDiscordUserId: targetUser.id,
    requesterDiscordUserId: interaction.user.id,
    permissionTier: permission?.accessTier ?? null,
    requestedVisibility,
  });

  if (!resolution.allowed) {
    await interaction.reply({
      content: resolution.reason ?? "You are not allowed to view this location.",
      ...ephemeralReplyOptions(),
    });
    return;
  }

  await interaction.deferReply((resolution.ephemeral ?? true) ? ephemeralDeferOptions() : undefined);

  try {
    const { snapshot } = await fetchTrackeeSnapshot(targetUser.id);
    const payload = await buildWhereIsMessagePayload({
      snapshot,
      displayName: displayNameForUser(targetUser),
      avatarUrl: userAvatarPngUrl(targetUser),
    });

    const sentMessage = await interaction.editReply(payload);

    if (!(resolution.ephemeral ?? true)) {
      const now = new Date();
      const createdAt = now.toISOString();
      const expiresAt = new Date(now.getTime() + 60 * 60 * 1000).toISOString();

      await deactivateLiveLocationMessagesForOwnerInChannel(targetUser.id, interaction.channelId, createdAt);
      await createLiveLocationMessage({
        ownerDiscordUserId: targetUser.id,
        channelId: interaction.channelId,
        guildId: interaction.guildId,
        messageId: sentMessage.id,
        createdByDiscordUserId: interaction.user.id,
        createdAt,
        expiresAt,
      });
    }
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
            .replace("Trackee has not registered Home Assistant.", `${displayNameForUser(targetUser)} has not registered Home Assistant.`)
            .replace("Trackee has not selected an entity yet.", `${displayNameForUser(targetUser)} has not selected an entity yet.`)
        : "Failed to fetch location.";
    await interaction.editReply({ content: message, embeds: [], files: [] });
  }
}

async function handleStopWhereIs(interaction: ChatInputCommandInteraction) {
  const targetUser = interaction.options.getUser("user", true);
  const permission =
    targetUser.id === interaction.user.id
      ? null
      : await getViewerPermission(targetUser.id, interaction.user.id);

  const resolution = resolveWhereIsAccess({
    ownerDiscordUserId: targetUser.id,
    requesterDiscordUserId: interaction.user.id,
    permissionTier: permission?.accessTier ?? null,
    requestedVisibility: "public",
  });

  if (!resolution.allowed) {
    await interaction.reply({
      content: resolution.reason ?? "You are not allowed to manage this user's live location messages.",
      ...ephemeralReplyOptions(),
    });
    return;
  }

  const nowIso = new Date().toISOString();
  const activeMessages = await listActiveLiveLocationMessagesForOwnerInChannel(
    targetUser.id,
    interaction.channelId,
    nowIso,
  );

  if (activeMessages.length === 0) {
    await interaction.reply({
      content: `No active live location message for ${displayNameForUser(targetUser)} exists in this channel.`,
      ...ephemeralReplyOptions(),
    });
    return;
  }

  await deactivateLiveLocationMessagesForOwnerInChannel(targetUser.id, interaction.channelId, nowIso);
  await interaction.reply({
    content: `Stopped live updates for ${displayNameForUser(targetUser)} in this channel.`,
    ...ephemeralReplyOptions(),
  });
}

async function handleUnregister(interaction: ChatInputCommandInteraction) {
  const updatedAt = new Date().toISOString();
  await Promise.all([
    deleteTrackedEntity(interaction.user.id),
    deleteHaConnection(interaction.user.id),
    deactivateAllLiveLocationMessagesForOwner(interaction.user.id, updatedAt),
  ]);
  await interaction.reply({
    content: "Removed your Home Assistant connection and tracked entity.",
    ...ephemeralReplyOptions(),
  });
}

async function handleChatCommand(interaction: ChatInputCommandInteraction) {
  switch (interaction.commandName) {
    case "register-ha":
      await handleRegisterHa(interaction);
      return;
    case "entity":
      await handleEntity(interaction);
      return;
    case "viewer":
      await handleViewer(interaction);
      return;
    case "whereis":
      await handleWhereIs(interaction);
      return;
    case "stop-whereis":
      await handleStopWhereIs(interaction);
      return;
    case "unregister-ha":
      await handleUnregister(interaction);
      return;
    default:
      await interaction.reply({
        content: "Unknown command.",
        ...ephemeralReplyOptions(),
      });
  }
}

async function handleInteractionCreate(interaction: Interaction) {
  if (await handleRegisterModal(interaction)) {
    return;
  }

  if (interaction.isAutocomplete()) {
    await handleAutocomplete(interaction);
    return;
  }

  if (!interaction.isChatInputCommand()) {
    return;
  }

  try {
    await handleChatCommand(interaction);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Something went wrong.";
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content: message, embeds: [], files: [] });
    } else {
      await interaction.reply({ content: message, ...ephemeralReplyOptions() });
    }
  }
}

export function createBotClient() {
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  client.once(Events.ClientReady, (readyClient) => {
    console.log(`Logged in as ${readyClient.user.tag}`);
    startLiveMessageUpdater(readyClient);
  });
  client.on(Events.InteractionCreate, (interaction) => {
    void handleInteractionCreate(interaction);
  });
  return client;
}
