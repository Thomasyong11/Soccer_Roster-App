import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertPlayerSchema, insertMatchReminderSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Get all players
  app.get("/api/players", async (req, res) => {
    try {
      const players = await storage.getAllPlayers();
      res.json(players);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch players" });
    }
  });

  // Get a specific player
  app.get("/api/players/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid player ID" });
      }

      const player = await storage.getPlayer(id);
      if (!player) {
        return res.status(404).json({ message: "Player not found" });
      }

      res.json(player);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch player" });
    }
  });

  // Create a new player
  app.post("/api/players", async (req, res) => {
    try {
      const validatedData = insertPlayerSchema.parse(req.body);
      
      // Check if jersey number is already taken
      const existingPlayer = await storage.getPlayerByJerseyNumber(validatedData.jerseyNumber);
      if (existingPlayer) {
        return res.status(400).json({ message: "Jersey number is already taken" });
      }

      const player = await storage.createPlayer(validatedData);
      res.status(201).json(player);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Validation error", 
          errors: error.errors 
        });
      }
      res.status(500).json({ message: "Failed to create player" });
    }
  });

  // Update a player
  app.patch("/api/players/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid player ID" });
      }

      const updateSchema = insertPlayerSchema.partial();
      const validatedData = updateSchema.parse(req.body);

      // If updating jersey number, check if it's already taken
      if (validatedData.jerseyNumber !== undefined) {
        const existingPlayer = await storage.getPlayerByJerseyNumber(validatedData.jerseyNumber);
        if (existingPlayer && existingPlayer.id !== id) {
          return res.status(400).json({ message: "Jersey number is already taken" });
        }
      }

      const updatedPlayer = await storage.updatePlayer(id, validatedData);
      if (!updatedPlayer) {
        return res.status(404).json({ message: "Player not found" });
      }

      res.json(updatedPlayer);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Validation error", 
          errors: error.errors 
        });
      }
      res.status(500).json({ message: "Failed to update player" });
    }
  });

  // Delete a player
  app.delete("/api/players/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid player ID" });
      }

      const deleted = await storage.deletePlayer(id);
      if (!deleted) {
        return res.status(404).json({ message: "Player not found" });
      }

      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete player" });
    }
  });

  // Toggle check-in status
  app.post("/api/players/:id/toggle-checkin", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid player ID" });
      }

      const updatedPlayer = await storage.toggleCheckIn(id);
      if (!updatedPlayer) {
        return res.status(404).json({ message: "Player not found" });
      }

      res.json(updatedPlayer);
    } catch (error) {
      res.status(500).json({ message: "Failed to toggle check-in status" });
    }
  });

  // Get player statistics
  app.get("/api/stats", async (req, res) => {
    try {
      const players = await storage.getAllPlayers();
      const totalPlayers = players.length;
      const checkedInPlayers = players.filter(p => p.isCheckedIn).length;
      
      const positionCounts = players.reduce((acc, player) => {
        acc[player.position] = (acc[player.position] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      res.json({
        totalPlayers,
        checkedInPlayers,
        attendanceRate: totalPlayers > 0 ? Math.round((checkedInPlayers / totalPlayers) * 100) : 0,
        positionCounts,
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch statistics" });
    }
  });

  // Natural language stats update
  app.post("/api/stats/natural", async (req, res) => {
    try {
      const { text } = req.body;
      if (!text || typeof text !== 'string') {
        return res.status(400).json({ message: "Text is required" });
      }

      const parsed = await storage.parseStatsFromText(text);
      if (!parsed) {
        return res.status(400).json({ message: "Could not parse stats from text" });
      }

      // Find player by name
      const players = await storage.getAllPlayers();
      const player = players.find(p => 
        p.name.toLowerCase().includes(parsed.playerName.toLowerCase()) ||
        parsed.playerName.toLowerCase().includes(p.name.toLowerCase())
      );

      if (!player) {
        return res.status(404).json({ message: `Player ${parsed.playerName} not found` });
      }

      const updatedPlayer = await storage.updatePlayerStats(player.id, parsed.stats);
      res.json({
        message: `Updated stats for ${player.name}`,
        player: updatedPlayer,
        parsedStats: parsed.stats
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to update stats" });
    }
  });

  // Smart position assignment
  app.get("/api/players/:id/smart-position", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid player ID" });
      }

      const suggestedPosition = await storage.getSmartPositionSuggestion(id);
      res.json({ suggestedPosition });
    } catch (error) {
      res.status(500).json({ message: "Failed to get position suggestion" });
    }
  });

  // Player name suggestions
  app.get("/api/suggestions", async (req, res) => {
    try {
      const { q } = req.query;
      if (!q || typeof q !== 'string') {
        return res.json([]);
      }

      const suggestions = await storage.getPlayerSuggestions(q);
      res.json(suggestions);
    } catch (error) {
      res.status(500).json({ message: "Failed to get suggestions" });
    }
  });

  // Match reminders
  app.post("/api/reminders", async (req, res) => {
    try {
      // Manual validation to handle date conversion properly
      const { playerId, matchTime, isActive = true } = req.body;
      
      if (!matchTime || isNaN(Date.parse(matchTime))) {
        return res.status(400).json({ 
          message: "Validation error", 
          errors: [{ path: ["matchTime"], message: "Valid match time is required" }]
        });
      }

      const reminderData = {
        playerId: playerId || null,
        matchTime: new Date(matchTime),
        isActive
      };

      const reminder = await storage.createMatchReminder(reminderData);
      
      // Set up timer for 5 minutes before match
      const now = new Date();
      const matchTimeDate = new Date(matchTime);
      const reminderTime = new Date(matchTimeDate.getTime() - 5 * 60 * 1000); // 5 minutes before
      
      if (reminderTime > now) {
        setTimeout(async () => {
          // In a real app, this would send a notification
          console.log(`Reminder: Match starting in 5 minutes for player ${playerId}`);
        }, reminderTime.getTime() - now.getTime());
      }

      res.status(201).json(reminder);
    } catch (error) {
      console.error('Error creating reminder:', error);
      res.status(500).json({ message: "Failed to create reminder" });
    }
  });

  app.get("/api/reminders", async (req, res) => {
    try {
      const reminders = await storage.getActiveReminders();
      res.json(reminders);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch reminders" });
    }
  });

  // Weekly performance summary
  app.get("/api/players/:id/weekly-summary", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid player ID" });
      }

      const player = await storage.getPlayer(id);
      if (!player) {
        return res.status(404).json({ message: "Player not found" });
      }

      try {
        const weeklyStats = JSON.parse(player.weeklyStats || "{}");
        const thisWeek = weeklyStats.thisWeek || { goals: 0, assists: 0, matches: 0 };
        const lastWeek = weeklyStats.lastWeek || { goals: 0, assists: 0, matches: 0 };

        const improvement = {
          goals: thisWeek.goals - lastWeek.goals,
          assists: thisWeek.assists - lastWeek.assists,
          matches: thisWeek.matches - lastWeek.matches
        };

        res.json({
          player: player.name,
          thisWeek,
          lastWeek,
          improvement,
          summary: `This week you scored ${thisWeek.goals} goals and had ${thisWeek.assists} assists in ${thisWeek.matches} matches`
        });
      } catch (parseError) {
        res.json({
          player: player.name,
          thisWeek: { goals: 0, assists: 0, matches: 0 },
          lastWeek: { goals: 0, assists: 0, matches: 0 },
          improvement: { goals: 0, assists: 0, matches: 0 },
          summary: "No weekly data available yet"
        });
      }
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch weekly summary" });
    }
  });

  // Update weekly stats (admin endpoint)
  app.post("/api/admin/update-weekly-stats", async (req, res) => {
    try {
      await storage.updateWeeklyStats();
      res.json({ message: "Weekly stats updated successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to update weekly stats" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
