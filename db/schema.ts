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

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  token: text("token").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  used: boolean("used").default(false),
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

export const rooms = pgTable("rooms", {
  id: serial("id").primaryKey(),
  code: text("code").unique().notNull(),
  scenarioId: integer("scenario_id").references(() => scenarios.id),
  creatorId: integer("creator_id").references(() => users.id),
  active: boolean("active").default(true),
  maxParticipants: integer("max_participants").default(5),
  createdAt: timestamp("created_at").defaultNow(),
});

export const roomParticipants = pgTable("room_participants", {
  id: serial("id").primaryKey(),
  roomId: integer("room_id").references(() => rooms.id),
  userId: integer("user_id").references(() => users.id),
  joinedAt: timestamp("joined_at").defaultNow(),
});

export const roomMessages = pgTable("room_messages", {
  id: serial("id").primaryKey(),
  roomId: integer("room_id").references(() => rooms.id),
  userId: integer("user_id").references(() => users.id),
  content: text("content").notNull(),
  timestamp: timestamp("timestamp").defaultNow(),
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

export const insertRoomSchema = createInsertSchema(rooms);
export const selectRoomSchema = createSelectSchema(rooms);

export const selectUserSchema = createSelectSchema(users);

export const passwordResetRequestSchema = z.object({
  email: z.string().email().refine(
    (email) => email.endsWith("acibadem.edu.tr") || email.endsWith("live.acibadem.edu.tr"),
    { message: "Email must be from acibadem.edu.tr or live.acibadem.edu.tr domain" }
  )
});

export const passwordResetSchema = z.object({
  token: z.string().min(1, "Reset token is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Scenario = typeof scenarios.$inferSelect;
export type UserProgress = typeof userProgress.$inferSelect;
export type Room = typeof rooms.$inferSelect;
export type RoomMessage = typeof roomMessages.$inferSelect;
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;