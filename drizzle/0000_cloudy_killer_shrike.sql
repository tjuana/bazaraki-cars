
CREATE TABLE `analyses` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`listing_id` integer NOT NULL,
	`fair_price_min` integer,
	`fair_price_max` integer,
	`overprice_percent` integer,
	`risk_score` integer,
	`risks` text DEFAULT '[]',
	`recommendation` text,
	`suggested_offer` integer,
	`summary` text NOT NULL,
	`questions_for_seller` text DEFAULT '[]',
	`raw_response` text,
	`analyzed_at` text NOT NULL,
	FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `call_notes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`listing_id` integer NOT NULL,
	`notes` text DEFAULT '',
	`checked_questions` text DEFAULT '[]',
	`called_at` text,
	`outcome` text,
	`saved_at` text NOT NULL,
	FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `configs` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `conversations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`listing_id` integer NOT NULL,
	`direction` text NOT NULL,
	`message` text NOT NULL,
	`whatsapp_link` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `listings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`external_id` text NOT NULL,
	`url` text NOT NULL,
	`title` text NOT NULL,
	`price` integer,
	`currency` text DEFAULT 'EUR',
	`year` integer,
	`mileage` integer,
	`engine_size` real,
	`fuel_type` text,
	`transmission` text,
	`body_type` text,
	`color` text,
	`brand` text,
	`model` text,
	`description` text,
	`phone_raw` text,
	`phone_normalized` text,
	`whatsapp_url` text,
	`seller_name` text,
	`seller_type` text DEFAULT 'unknown',
	`district` text,
	`image_urls` text DEFAULT '[]',
	`scraped_at` text NOT NULL,
	`source` text DEFAULT 'bazaraki' NOT NULL,
	`status` text DEFAULT 'new' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `listings_external_id_unique` ON `listings` (`external_id`);--> statement-breakpoint
CREATE TABLE `photo_analyses` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`listing_id` integer NOT NULL,
	`overall_condition` text NOT NULL,
	`issues` text DEFAULT '[]',
	`positives` text DEFAULT '[]',
	`accident_suspicion` text NOT NULL,
	`summary` text NOT NULL,
	`auction_sheet` text,
	`analyzed_at` text NOT NULL,
	FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `photo_analyses_listing_id_unique` ON `photo_analyses` (`listing_id`);--> statement-breakpoint
CREATE TABLE `price_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`listing_id` integer NOT NULL,
	`old_price` integer,
	`new_price` integer NOT NULL,
	`source` text DEFAULT 'scrape' NOT NULL,
	`changed_at` text NOT NULL,
	FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON UPDATE no action ON DELETE no action
);
