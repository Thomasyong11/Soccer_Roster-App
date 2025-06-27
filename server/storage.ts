import { players, matchReminders, playerSuggestions, type Player, type InsertPlayer, type MatchReminder, type InsertMatchReminder, type PlayerSuggestion, type InsertPlayerSuggestion } from "@shared/schema";
import { db } from "./db";
import { eq, like, desc } from "drizzle-orm";

export interface IStorage {
  // Player operations
  getPlayer(id: number): Promise<Player | undefined>;
  getAllPlayers(): Promise<Player[]>;
  getPlayerByJerseyNumber(jerseyNumber: number): Promise<Player | undefined>;
  createPlayer(player: InsertPlayer): Promise<Player>;
  updatePlayer(id: number, updates: Partial<Player>): Promise<Player | undefined>;
  deletePlayer(id: number): Promise<boolean>;
  toggleCheckIn(id: number): Promise<Player | undefined>;
  updatePlayerStats(id: number, stats: { goals?: number; assists?: number; redCards?: number; yellowCards?: number }): Promise<Player | undefined>;
  getSmartPositionSuggestion(playerId: number): Promise<string>;
  updateWeeklyStats(): Promise<void>;
  
  // Match reminder operations
  createMatchReminder(reminder: InsertMatchReminder): Promise<MatchReminder>;
  getActiveReminders(): Promise<MatchReminder[]>;
  deactivateReminder(id: number): Promise<boolean>;
  
  // Player suggestion operations
  getPlayerSuggestions(query: string): Promise<string[]>;
  updatePlayerSuggestion(name: string): Promise<void>;
  
  // Natural language processing
  parseStatsFromText(text: string): Promise<{ playerName: string; stats: any } | null>;
}

export class DatabaseStorage implements IStorage {
  async getPlayer(id: number): Promise<Player | undefined> {
    const [player] = await db.select().from(players).where(eq(players.id, id));
    return player || undefined;
  }

  async getAllPlayers(): Promise<Player[]> {
    return await db.select().from(players).orderBy(players.jerseyNumber);
  }

  async getPlayerByJerseyNumber(jerseyNumber: number): Promise<Player | undefined> {
    const [player] = await db.select().from(players).where(eq(players.jerseyNumber, jerseyNumber));
    return player || undefined;
  }

  async createPlayer(insertPlayer: InsertPlayer): Promise<Player> {
    const playerData = {
      ...insertPlayer,
      phone: insertPlayer.phone || null,
      preferredFoot: insertPlayer.preferredFoot || "right",
      playtimeHistory: "[]",
      positionHistory: JSON.stringify([insertPlayer.position]),
      goals: insertPlayer.goals || 0,
      assists: insertPlayer.assists || 0,
      redCards: insertPlayer.redCards || 0,
      yellowCards: insertPlayer.yellowCards || 0,
      matchesPlayed: insertPlayer.matchesPlayed || 0,
      weeklyStats: JSON.stringify({ thisWeek: { goals: 0, assists: 0, matches: 0 }, lastWeek: { goals: 0, assists: 0, matches: 0 } }),
    };

    const [player] = await db
      .insert(players)
      .values(playerData)
      .returning();
    
    // Update suggestion after creation
    await this.updatePlayerSuggestion(player.name);
    return player;
  }

  async updatePlayer(id: number, updates: Partial<Player>): Promise<Player | undefined> {
    const [updatedPlayer] = await db
      .update(players)
      .set(updates)
      .where(eq(players.id, id))
      .returning();
    
    return updatedPlayer || undefined;
  }

  async deletePlayer(id: number): Promise<boolean> {
    const result = await db.delete(players).where(eq(players.id, id));
    return result.rowCount > 0;
  }

  async toggleCheckIn(id: number): Promise<Player | undefined> {
    const player = await this.getPlayer(id);
    if (!player) return undefined;
    
    const [updatedPlayer] = await db
      .update(players)
      .set({ isCheckedIn: !player.isCheckedIn })
      .where(eq(players.id, id))
      .returning();
    
    return updatedPlayer || undefined;
  }

  async updatePlayerStats(id: number, stats: { goals?: number; assists?: number; redCards?: number; yellowCards?: number }): Promise<Player | undefined> {
    const player = await this.getPlayer(id);
    if (!player) return undefined;
    
    const updates = {
      goals: stats.goals !== undefined ? player.goals + stats.goals : player.goals,
      assists: stats.assists !== undefined ? player.assists + stats.assists : player.assists,
      redCards: stats.redCards !== undefined ? player.redCards + stats.redCards : player.redCards,
      yellowCards: stats.yellowCards !== undefined ? player.yellowCards + stats.yellowCards : player.yellowCards,
    };
    
    return await this.updatePlayer(id, updates);
  }

  async getSmartPositionSuggestion(playerId: number): Promise<string> {
    const player = await this.getPlayer(playerId);
    if (!player) return "midfielder";
    
    try {
      const positionHistory = JSON.parse(player.positionHistory || "[]");
      const playtimeHistory = JSON.parse(player.playtimeHistory || "[]");
      
      // Count position frequency
      const positionCounts = positionHistory.reduce((acc: any, pos: string) => {
        acc[pos] = (acc[pos] || 0) + 1;
        return acc;
      }, {});
      
      // Get most played position
      const mostPlayedPosition = Object.keys(positionCounts).reduce((a, b) => 
        positionCounts[a] > positionCounts[b] ? a : b, player.position);
      
      // Consider recent playtime and performance
      if (playtimeHistory.length > 0) {
        const recentPerformance = playtimeHistory.slice(-3);
        const avgPerformance = recentPerformance.reduce((sum: number, p: any) => sum + (p.rating || 0), 0) / recentPerformance.length;
        
        // If performance is good in current position, stick with it
        if (avgPerformance > 7) {
          return player.position;
        }
      }
      
      return mostPlayedPosition;
    } catch (error) {
      return player.position;
    }
  }

  async updateWeeklyStats(): Promise<void> {
    const allPlayers = await this.getAllPlayers();
    
    for (const player of allPlayers) {
      try {
        const weeklyStats = JSON.parse(player.weeklyStats || "{}");
        
        // Move this week to last week
        weeklyStats.lastWeek = weeklyStats.thisWeek || { goals: 0, assists: 0, matches: 0 };
        weeklyStats.thisWeek = { goals: 0, assists: 0, matches: 0 };
        
        await this.updatePlayer(player.id, {
          weeklyStats: JSON.stringify(weeklyStats)
        });
      } catch (error) {
        console.error('Error updating weekly stats for player', player.id, error);
      }
    }
  }

  async createMatchReminder(reminder: InsertMatchReminder): Promise<MatchReminder> {
    const reminderData = {
      playerId: reminder.playerId || null,
      matchTime: reminder.matchTime,
      isActive: reminder.isActive ?? true,
    };

    const [matchReminder] = await db
      .insert(matchReminders)
      .values(reminderData)
      .returning();
    
    return matchReminder;
  }

  async getActiveReminders(): Promise<MatchReminder[]> {
    return await db.select().from(matchReminders).where(eq(matchReminders.isActive, true));
  }

  async deactivateReminder(id: number): Promise<boolean> {
    const result = await db
      .update(matchReminders)
      .set({ isActive: false })
      .where(eq(matchReminders.id, id));
    
    return result.rowCount > 0;
  }

  async getPlayerSuggestions(query: string): Promise<string[]> {
    if (!query || query.length < 2) return [];
    
    const suggestions = await db
      .select()
      .from(playerSuggestions)
      .where(like(playerSuggestions.name, `%${query}%`))
      .orderBy(desc(playerSuggestions.frequency))
      .limit(5);
    
    return suggestions.map(s => s.name);
  }

  async updatePlayerSuggestion(name: string): Promise<void> {
    const existing = await db
      .select()
      .from(playerSuggestions)
      .where(eq(playerSuggestions.name, name))
      .limit(1);
    
    if (existing.length > 0) {
      await db
        .update(playerSuggestions)
        .set({ 
          frequency: existing[0].frequency + 1,
          lastUsed: new Date()
        })
        .where(eq(playerSuggestions.id, existing[0].id));
    } else {
      await db
        .insert(playerSuggestions)
        .values({
          name,
          frequency: 1,
        });
    }
  }

  async parseStatsFromText(text: string): Promise<{ playerName: string; stats: any } | null> {
    const lowerText = text.toLowerCase();
    
    // Extract player name (first word that's capitalized)
    const nameMatch = text.match(/\b([A-Z][a-z]+)\b/);
    if (!nameMatch) return null;
    
    const playerName = nameMatch[1];
    const stats: any = {};
    
    // Parse goals
    const goalPatterns = [
      /(\d+)\s*goals?/i,
      /scored\s*(\d+)/i,
      /(\d+)\s*times?/i
    ];
    
    for (const pattern of goalPatterns) {
      const match = lowerText.match(pattern);
      if (match) {
        stats.goals = parseInt(match[1]);
        break;
      }
    }
    
    // Parse assists
    const assistPatterns = [
      /(\d+)\s*assists?/i,
      /assisted\s*(\d+)/i
    ];
    
    for (const pattern of assistPatterns) {
      const match = lowerText.match(pattern);
      if (match) {
        stats.assists = parseInt(match[1]);
        break;
      }
    }
    
    // Parse cards
    if (lowerText.includes('red card')) {
      stats.redCards = 1;
    }
    if (lowerText.includes('yellow card')) {
      stats.yellowCards = 1;
    }
    
    // Single event patterns
    if (lowerText.includes('scored') && !stats.goals) {
      stats.goals = 1;
    }
    if (lowerText.includes('assist') && !stats.assists) {
      stats.assists = 1;
    }
    
    return Object.keys(stats).length > 0 ? { playerName, stats } : null;
  }
}

export const storage = new DatabaseStorage();
