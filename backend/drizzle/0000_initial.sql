CREATE TABLE `matches` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `home_team` text NOT NULL,
  `away_team` text NOT NULL,
  `status` text DEFAULT 'EN_JUEGO' NOT NULL,
  `home_score` integer DEFAULT 0 NOT NULL,
  `away_score` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `match_events` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `match_id` integer NOT NULL,
  `minute` integer NOT NULL,
  `type` text NOT NULL,
  `team` text NOT NULL,
  `description` text NOT NULL,
  `created_at` text NOT NULL,
  FOREIGN KEY (`match_id`) REFERENCES `matches`(`id`) ON UPDATE no action ON DELETE cascade
);
