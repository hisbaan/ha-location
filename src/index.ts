import { env } from "./config/env";
import { runMigrations } from "./db";
import { createBotClient } from "./discord/bot";

runMigrations();

const client = createBotClient();

await client.login(env.discordBotToken);
