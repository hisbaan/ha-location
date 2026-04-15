CREATE TABLE `ha_connections` (
	`discord_user_id` text PRIMARY KEY NOT NULL,
	`ha_base_url` text NOT NULL,
	`encrypted_access_token` text NOT NULL,
	`auth_type` text DEFAULT 'long_lived_token' NOT NULL,
	`last_validated_at` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `tracked_entities` (
	`discord_user_id` text PRIMARY KEY NOT NULL,
	`entity_id` text NOT NULL,
	`friendly_name` text NOT NULL,
	`entity_domain` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `viewer_permissions` (
	`owner_discord_user_id` text NOT NULL,
	`viewer_discord_user_id` text NOT NULL,
	`access_tier` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`owner_discord_user_id`, `viewer_discord_user_id`)
);
