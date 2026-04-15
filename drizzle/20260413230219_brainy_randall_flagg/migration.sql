CREATE TABLE `live_location_messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`owner_discord_user_id` text NOT NULL,
	`channel_id` text NOT NULL,
	`guild_id` text,
	`message_id` text NOT NULL,
	`created_by_discord_user_id` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`expires_at` text NOT NULL,
	`updated_at` text NOT NULL
);
