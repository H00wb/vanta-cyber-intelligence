import { sql } from "drizzle-orm";
import { sqliteTable, text, check } from "drizzle-orm/sqlite-core";
export const serviceRequests = sqliteTable("service_requests", {
  id: text("id").primaryKey(), name: text("name").notNull(), email: text("email").notNull(),
  service: text("service").notNull(), description: text("description").notNull(), createdAt: text("created_at").notNull(),
}, table => [
  check("name_length", sql`length(${table.name}) between 2 and 100`),
  check("email_length", sql`length(${table.email}) between 3 and 254`),
  check("description_length", sql`length(${table.description}) between 20 and 2000`),
  check("known_service", sql`${table.service} in ('threat-intelligence', 'attack-surface', 'incident-correlation', 'risk-mapping')`),
]);