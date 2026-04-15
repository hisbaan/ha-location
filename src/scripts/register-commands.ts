import { REST, Routes } from "discord.js";

import { env } from "../config/env";
import { commandDefinitions } from "../discord/commands";

const rest = new REST({ version: "10" }).setToken(env.discordBotToken);

if (env.discordGuildId) {
  await rest.put(Routes.applicationGuildCommands(env.discordApplicationId, env.discordGuildId), {
    body: commandDefinitions,
  });
  console.log(`Registered ${commandDefinitions.length} guild commands.`);
} else {
  await rest.put(Routes.applicationCommands(env.discordApplicationId), {
    body: commandDefinitions,
  });
  console.log(`Registered ${commandDefinitions.length} global commands.`);
}
