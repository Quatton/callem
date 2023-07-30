-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE TABLE `phone_codes` (
	`phone` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`expires` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `verified_user` (
	`phone` text PRIMARY KEY NOT NULL,
	`email` text
);

*/