import { ApplicationCommandOptionType, type RESTPostAPIApplicationCommandsJSONBody } from "discord.js";

export const REGISTER_HA_MODAL_ID = "register-ha-modal";
export const REGISTER_HA_BASE_URL_ID = "ha-base-url";
export const REGISTER_HA_TOKEN_ID = "ha-access-token";

export const commandDefinitions: RESTPostAPIApplicationCommandsJSONBody[] = [
  {
    name: "register-ha",
    description: "Register your Home Assistant instance and token",
  },
  {
    name: "entity",
    description: "Manage your tracked Home Assistant entity",
    options: [
      {
        type: ApplicationCommandOptionType.Subcommand,
        name: "set",
        description: "Choose which Home Assistant entity represents you",
        options: [
          {
            type: ApplicationCommandOptionType.String,
            name: "entity-id",
            description: "Entity id from Home Assistant",
            required: true,
            autocomplete: true,
          },
        ],
      },
      {
        type: ApplicationCommandOptionType.Subcommand,
        name: "status",
        description: "Show your current entity selection",
      },
    ],
  },
  {
    name: "viewer",
    description: "Manage who can see your location",
    options: [
      {
        type: ApplicationCommandOptionType.Subcommand,
        name: "set",
        description: "Grant or update access for a viewer",
        options: [
          {
            type: ApplicationCommandOptionType.User,
            name: "user",
            description: "Discord user to grant access to",
            required: true,
          },
          {
            type: ApplicationCommandOptionType.String,
            name: "tier",
            description: "Access tier for that viewer",
            required: true,
            choices: [
              { name: "Ephemeral", value: "ephemeral" },
              { name: "Public", value: "public" },
            ],
          },
        ],
      },
      {
        type: ApplicationCommandOptionType.Subcommand,
        name: "remove",
        description: "Remove a viewer's access",
        options: [
          {
            type: ApplicationCommandOptionType.User,
            name: "user",
            description: "Discord user to revoke access from",
            required: true,
          },
        ],
      },
      {
        type: ApplicationCommandOptionType.Subcommand,
        name: "list",
        description: "List current viewers and their access tiers",
      },
    ],
  },
  {
    name: "whereis",
    description: "Show the latest known location for a user",
    options: [
      {
        type: ApplicationCommandOptionType.User,
        name: "user",
        description: "Discord user whose location you want to view",
        required: true,
      },
      {
        type: ApplicationCommandOptionType.String,
        name: "visibility",
        description: "How the result should be sent (auto uses the highest allowed visibility)",
        choices: [
          { name: "Auto (highest allowed)", value: "auto" },
          { name: "Ephemeral", value: "ephemeral" },
          { name: "Public", value: "public" },
        ],
      },
    ],
  },
  {
    name: "stop-whereis",
    description: "Stop live location updates for a user in this channel",
    options: [
      {
        type: ApplicationCommandOptionType.User,
        name: "user",
        description: "Discord user whose live location updates should stop",
        required: true,
      },
    ],
  },
  {
    name: "unregister-ha",
    description: "Remove your Home Assistant connection and tracked entity",
  },
];
