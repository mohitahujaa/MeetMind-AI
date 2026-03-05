/**
 * Database Schema Definition
 * 
 * This file defines the PostgreSQL schema for MeetMind.
 * All tables are designed to support the agent execution loop and memory system.
 * 
 * Schema design principles:
 * - Normalized structure
 * - Clear foreign key relationships
 * - JSON columns for flexible metadata
 * - Prepared for pgvector extension (Phase 2)
 */

import { Pool } from 'pg';

// Singleton database pool
let pool: Pool | null = null;

/**
 * Get or create database connection pool
 */
export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    pool.on('error', (err) => {
      console.error('Unexpected database error:', err);
    });
  }

  return pool;
}

/**
 * Initialize database schema
 * Creates all required tables if they don't exist
 */
export async function initDatabase(): Promise<void> {
  const pool = getPool();

  const schema = `
    -- Enable UUID extension
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

    -- Users table
    -- Stores user information
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      email VARCHAR(255) UNIQUE NOT NULL,
      name VARCHAR(255) NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    -- Sessions table
    -- Tracks user sessions and context
    CREATE TABLE IF NOT EXISTS sessions (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      context JSONB DEFAULT '{}',
      ended_at TIMESTAMP WITH TIME ZONE,
      CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id)
    );

    -- Create index on user_id for faster session lookups
    CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_last_activity ON sessions(last_activity_at DESC);

    -- Interactions table
    -- Logs all user queries and agent responses
    CREATE TABLE IF NOT EXISTS interactions (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      query TEXT NOT NULL,
      response TEXT,
      status VARCHAR(50) NOT NULL CHECK (status IN ('success', 'error', 'pending')),
      error_message TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_session FOREIGN KEY (session_id) REFERENCES sessions(id),
      CONSTRAINT fk_interaction_user FOREIGN KEY (user_id) REFERENCES users(id)
    );

    -- Create indexes for faster interaction lookups
    CREATE INDEX IF NOT EXISTS idx_interactions_session_id ON interactions(session_id);
    CREATE INDEX IF NOT EXISTS idx_interactions_user_id ON interactions(user_id);
    CREATE INDEX IF NOT EXISTS idx_interactions_created_at ON interactions(created_at DESC);

    -- Tool calls table
    -- Logs every tool execution
    CREATE TABLE IF NOT EXISTS tool_calls (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      interaction_id UUID NOT NULL REFERENCES interactions(id) ON DELETE CASCADE,
      tool_name VARCHAR(100) NOT NULL,
      parameters JSONB NOT NULL,
      result JSONB,
      success BOOLEAN NOT NULL,
      error_message TEXT,
      executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_interaction FOREIGN KEY (interaction_id) REFERENCES interactions(id)
    );

    -- Create indexes for tool call analytics
    CREATE INDEX IF NOT EXISTS idx_tool_calls_interaction_id ON tool_calls(interaction_id);
    CREATE INDEX IF NOT EXISTS idx_tool_calls_tool_name ON tool_calls(tool_name);
    CREATE INDEX IF NOT EXISTS idx_tool_calls_executed_at ON tool_calls(executed_at DESC);

    -- Meetings table
    -- Stores meeting metadata and summaries
    CREATE TABLE IF NOT EXISTS meetings (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title VARCHAR(500) NOT NULL,
      participants TEXT[] DEFAULT '{}',
      start_time TIMESTAMP WITH TIME ZONE NOT NULL,
      end_time TIMESTAMP WITH TIME ZONE,
      summary TEXT,
      transcript TEXT,
      action_items TEXT[] DEFAULT '{}',
      decisions TEXT[] DEFAULT '{}',
      metadata JSONB DEFAULT '{}',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_meeting_user FOREIGN KEY (user_id) REFERENCES users(id)
    );

    -- Create indexes for meeting queries
    CREATE INDEX IF NOT EXISTS idx_meetings_user_id ON meetings(user_id);
    CREATE INDEX IF NOT EXISTS idx_meetings_start_time ON meetings(start_time DESC);

    -- Memories table
    -- Stores long-term memory items (decisions, notes, action items)
    -- Prepared for vector embeddings in Phase 2
    CREATE TABLE IF NOT EXISTS memories (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type VARCHAR(50) NOT NULL CHECK (type IN ('meeting', 'decision', 'action_item', 'note')),
      content TEXT NOT NULL,
      metadata JSONB DEFAULT '{}',
      related_meeting_id UUID REFERENCES meetings(id) ON DELETE SET NULL,
      related_interaction_id UUID REFERENCES interactions(id) ON DELETE SET NULL,
      -- Vector embedding column (will be populated in Phase 2)
      -- embedding vector(1536),  -- Uncomment when pgvector is enabled
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_memory_user FOREIGN KEY (user_id) REFERENCES users(id)
    );

    -- Create indexes for memory searches
    CREATE INDEX IF NOT EXISTS idx_memories_user_id ON memories(user_id);
    CREATE INDEX IF NOT EXISTS idx_memories_type ON memories(type);
    CREATE INDEX IF NOT EXISTS idx_memories_created_at ON memories(created_at DESC);
    -- GIN index for JSONB metadata queries
    CREATE INDEX IF NOT EXISTS idx_memories_metadata ON memories USING GIN (metadata);

    -- Create updated_at trigger function
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = CURRENT_TIMESTAMP;
      RETURN NEW;
    END;
    $$ language 'plpgsql';

    -- Apply updated_at trigger to relevant tables
    DROP TRIGGER IF EXISTS update_users_updated_at ON users;
    CREATE TRIGGER update_users_updated_at
      BEFORE UPDATE ON users
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();

    DROP TRIGGER IF EXISTS update_meetings_updated_at ON meetings;
    CREATE TRIGGER update_meetings_updated_at
      BEFORE UPDATE ON meetings
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();

    DROP TRIGGER IF EXISTS update_memories_updated_at ON memories;
    CREATE TRIGGER update_memories_updated_at
      BEFORE UPDATE ON memories
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  `;

  try {
    await pool.query(schema);
    console.log('Database schema initialized successfully');
  } catch (error) {
    console.error('Failed to initialize database schema:', error);
    throw error;
  }
}

/**
 * Close database connection pool
 */
export async function closeDatabase(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
