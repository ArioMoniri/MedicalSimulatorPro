import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").unique().notNull(),
  email: text("email").unique().notNull(),
  password: text("password").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const scenarios = pgTable("scenarios", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  type: text("type").notNull(), // "emergency" or "clinical"
  description: text("description").notNull(),
  content: jsonb("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const userProgress = pgTable("user_progress", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  scenarioId: integer("scenario_id").references(() => scenarios.id),
  completed: boolean("completed").default(false),
  score: integer("score"),
  feedback: text("feedback"),
  completedAt: timestamp("completed_at"),
});

export const insertUserSchema = createInsertSchema(users).extend({
  email: z.string().email().refine(
    (email) => email.endsWith("acibadem.edu.tr") || email.endsWith("live.acibadem.edu.tr"),
    { message: "Email must be from acibadem.edu.tr or live.acibadem.edu.tr domain" }
  )
});

export const selectUserSchema = createSelectSchema(users);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Scenario = typeof scenarios.$inferSelect;
export type UserProgress = typeof userProgress.$inferSelect;
