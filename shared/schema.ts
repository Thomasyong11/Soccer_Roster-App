import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const players = pgTable("players", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  position: text("position").notNull(),
  jerseyNumber: integer("jersey_number").notNull().unique(),
  phone: text("phone"),
  isCheckedIn: boolean("is_checked_in").notNull().default(false),
  preferredFoot: text("preferred_foot").default("right"),
  playtimeHistory: text("playtime_history").default("[]"), // JSON array
  positionHistory: text("position_history").default("[]"), // JSON array
  goals: integer("goals").notNull().default(0),
  assists: integer("assists").notNull().default(0),
  redCards: integer("red_cards").notNull().default(0),
  yellowCards: integer("yellow_cards").notNull().default(0),
  matchesPlayed: integer("matches_played").notNull().default(0),
  weeklyStats: text("weekly_stats").default("{}"), // JSON object
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const matchReminders = pgTable("match_reminders", {
  id: serial("id").primaryKey(),
  playerId: integer("player_id").references(() => players.id),
  matchTime: timestamp("match_time").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const playerSuggestions = pgTable("player_suggestions", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  frequency: integer("frequency").notNull().default(1),
  lastUsed: timestamp("last_used").notNull().defaultNow(),
});

export const insertPlayerSchema = createInsertSchema(players).omit({
  id: true,
  createdAt: true,
  playtimeHistory: true,
  positionHistory: true,
  weeklyStats: true,
}).extend({
  name: z.string().min(1, "Player name is required"),
  position: z.enum(["goalkeeper", "defender", "midfielder", "forward"], {
    required_error: "Position is required",
  }),
  jerseyNumber: z.number().min(1, "Jersey number must be at least 1").max(99, "Jersey number must be at most 99"),
  phone: z.string().optional(),
  preferredFoot: z.enum(["left", "right", "both"]).optional().default("right"),
  isCheckedIn: z.boolean().default(false),
  goals: z.number().min(0).default(0),
  assists: z.number().min(0).default(0),
  redCards: z.number().min(0).default(0),
  yellowCards: z.number().min(0).default(0),
  matchesPlayed: z.number().min(0).default(0),
});

export const insertMatchReminderSchema = createInsertSchema(matchReminders).omit({
  id: true,
  createdAt: true,
});

export const insertPlayerSuggestionSchema = createInsertSchema(playerSuggestions).omit({
  id: true,
  lastUsed: true,
});

export type InsertPlayer = z.infer<typeof insertPlayerSchema>;
export type Player = typeof players.$inferSelect;
export type InsertMatchReminder = z.infer<typeof insertMatchReminderSchema>;
export type MatchReminder = typeof matchReminders.$inferSelect;
export type InsertPlayerSuggestion = z.infer<typeof insertPlayerSuggestionSchema>;
export type PlayerSuggestion = typeof playerSuggestions.$inferSelect;
