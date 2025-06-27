# Soccer Player Registration & Check-in System

## Overview
A React-Express soccer player registration and check-in system with position and jersey number tracking. The application includes player management, check-in functionality, and team formation generation.

## Project Architecture
- **Frontend**: React with TypeScript, Wouter for routing, TanStack Query for data fetching
- **Backend**: Express.js with TypeScript, PostgreSQL database with Drizzle ORM
- **Database**: PostgreSQL with persistent player data, match reminders, and suggestions
- **UI Components**: Shadcn/ui with Tailwind CSS
- **Styling**: Soccer-themed green color scheme

## Recent Changes
- **2025-01-22**: Migrated to PostgreSQL database for persistent data storage
  - Replaced in-memory storage with PostgreSQL using Drizzle ORM
  - Created database schema with players, match reminders, and player suggestions tables
  - Successfully pushed schema to database with all advanced features intact
  - All player data, stats, and preferences now persist between sessions
  - Database includes support for position history, weekly stats, and natural language parsing

## Features
- Player registration with name, position, jersey number, and phone
- Check-in/check-out system for attendance tracking
- Team formation generator with multiple formation options
- Position-based statistics and filtering
- Soccer-themed responsive design

## User Preferences
- Simple, everyday language for communication
- Focus on practical functionality over technical details