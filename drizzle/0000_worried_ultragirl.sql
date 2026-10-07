CREATE TABLE `service_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`service` text NOT NULL,
	`description` text NOT NULL,
	`created_at` text NOT NULL,
	CONSTRAINT "name_length" CHECK(length("service_requests"."name") between 2 and 100),
	CONSTRAINT "email_length" CHECK(length("service_requests"."email") between 3 and 254),
	CONSTRAINT "description_length" CHECK(length("service_requests"."description") between 20 and 2000),
	CONSTRAINT "known_service" CHECK("service_requests"."service" in ('threat-intelligence', 'attack-surface', 'incident-correlation', 'risk-mapping'))
);
