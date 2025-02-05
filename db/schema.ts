import { pgTable, text, serial, integer, boolean, timestamp, jsonb, real } from "drizzle-orm/pg-core";
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
  description: text("description").notNull(),
  type: text("type").notNull(),
  content: jsonb("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const rooms = pgTable("rooms", {
  id: serial("id").primaryKey(),
  code: text("code").unique().notNull(),
  scenarioId: integer("scenario_id").references(() => scenarios.id).notNull(),
  creatorId: integer("creator_id").references(() => users.id).notNull(),
  maxParticipants: integer("max_participants").default(4),
  createdAt: timestamp("created_at").defaultNow(),
  endedAt: timestamp("ended_at"),
  lastMessageAt: timestamp("last_message_at").defaultNow(),
});

export const roomParticipants = pgTable("room_participants", {
  id: serial("id").primaryKey(),
  roomId: integer("room_id").references(() => rooms.id).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  joinedAt: timestamp("joined_at").defaultNow(),
  leftAt: timestamp("left_at"),
});

export const roomMessages = pgTable("room_messages", {
  id: serial("id").primaryKey(),
  roomId: integer("room_id").references(() => rooms.id).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  isAssistant: boolean("is_assistant").default(false),
});

export const userProgress = pgTable("user_progress", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  scenarioId: integer("scenario_id").references(() => scenarios.id).notNull(),
  score: integer("score").notNull(),
  feedback: text("feedback"),
  completedAt: timestamp("completed_at").defaultNow(),
});

export const vitalSigns = pgTable("vital_signs", {
  id: serial("id").primaryKey(),
  threadId: text("thread_id").notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  timestamp: timestamp("timestamp").defaultNow(),
  heartRate: integer("heart_rate"),
  systolicBP: integer("systolic_bp"),
  diastolicBP: integer("diastolic_bp"),
  respiratoryRate: integer("respiratory_rate"),
  spo2: integer("spo2"),
  temperature: real("temperature"),
});

// Schema validation
export const insertUserSchema = createInsertSchema(users).extend({
  email: z.string().email().refine(
    (email) => email.endsWith("acibadem.edu.tr") || email.endsWith("live.acibadem.edu.tr"),
    { message: "Email must be from acibadem.edu.tr or live.acibadem.edu.tr domain" }
  )
});
export const selectUserSchema = createSelectSchema(users);

export const insertScenarioSchema = createInsertSchema(scenarios);
export const selectScenarioSchema = createSelectSchema(scenarios);

export const insertRoomSchema = createInsertSchema(rooms);
export const selectRoomSchema = createSelectSchema(rooms);

export const insertRoomMessageSchema = createInsertSchema(roomMessages);
export const selectRoomMessageSchema = createSelectSchema(roomMessages);

export const insertRoomParticipantSchema = createInsertSchema(roomParticipants);
export const selectRoomParticipantSchema = createSelectSchema(roomParticipants);

export const insertUserProgressSchema = createInsertSchema(userProgress);
export const selectUserProgressSchema = createSelectSchema(userProgress);

export const insertVitalSignsSchema = createInsertSchema(vitalSigns).extend({
  heartRate: z.number().min(0).max(300),
  systolicBP: z.number().min(0).max(300),
  diastolicBP: z.number().min(0).max(300),
  respiratoryRate: z.number().min(0).max(100),
  spo2: z.number().min(0).max(100),
  temperature: z.number().min(20).max(45),
});

export const selectVitalSignsSchema = createSelectSchema(vitalSigns);

// Password reset schemas
export const passwordResetRequestSchema = z.object({
  email: z.string().email().refine(
    (email) => email.endsWith("acibadem.edu.tr") || email.endsWith("live.acibadem.edu.tr"),
    { message: "Email must be from acibadem.edu.tr or live.acibadem.edu.tr domain" }
  )
});

export const passwordResetSchema = z.object({
  password: z.string().min(6, "Password must be at least 6 characters"),
});

// Type exports
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type Scenario = typeof scenarios.$inferSelect;
export type NewScenario = typeof scenarios.$inferInsert;
export type Room = typeof rooms.$inferSelect;
export type NewRoom = typeof rooms.$inferInsert;
export type RoomMessage = typeof roomMessages.$inferSelect;
export type NewRoomMessage = typeof roomMessages.$inferInsert;
export type RoomParticipant = typeof roomParticipants.$inferSelect;
export type NewRoomParticipant = typeof roomParticipants.$inferInsert;
export type UserProgress = typeof userProgress.$inferSelect;
export type NewUserProgress = typeof userProgress.$inferInsert;
export type VitalSign = typeof vitalSigns.$inferSelect;
export type NewVitalSign = typeof vitalSigns.$inferInsert;