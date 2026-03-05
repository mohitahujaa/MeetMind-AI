/**
 * Database Queries
 * 
 * This file contains all database query functions.
 * Each function is responsible for a specific database operation.
 * 
 * Design principles:
 * - One function per query type
 * - Type-safe parameters and returns
 * - Proper error handling
 * - Transaction support where needed
 */

import { getPool } from './schema';
import type {
  User,
  Session,
  InteractionRecord,
  ToolCallRecord,
  MeetingRecord,
  MemoryRecord,
  SessionContext,
} from '@meetmind/shared';

// ============================================================================
// USER QUERIES
// ============================================================================

/**
 * Find user by email or create if doesn't exist
 */
export async function findOrCreateUser(email: string, name: string): Promise<User> {
  const pool = getPool();

  const result = await pool.query(
    `INSERT INTO users (email, name)
     VALUES ($1, $2)
     ON CONFLICT (email) DO UPDATE SET name = $2
     RETURNING id, email, name, created_at, updated_at`,
    [email, name]
  );

  return result.rows[0];
}

/**
 * Get user by ID
 */
export async function getUserById(userId: string): Promise<User | null> {
  const pool = getPool();

  const result = await pool.query(
    'SELECT id, email, name, created_at, updated_at FROM users WHERE id = $1',
    [userId]
  );

  return result.rows[0] || null;
}

// ============================================================================
// SESSION QUERIES
// ============================================================================

/**
 * Create new session
 */
export async function createSession(userId: string, context: SessionContext): Promise<Session> {
  const pool = getPool();

  const result = await pool.query(
    `INSERT INTO sessions (user_id, context, last_activity_at)
     VALUES ($1, $2, CURRENT_TIMESTAMP)
     RETURNING id, user_id, started_at, last_activity_at, context`,
    [userId, JSON.stringify(context)]
  );

  return {
    ...result.rows[0],
    context: result.rows[0].context,
  };
}

/**
 * Get active session by ID
 */
export async function getSession(sessionId: string): Promise<Session | null> {
  const pool = getPool();

  const result = await pool.query(
    `SELECT id, user_id, started_at, last_activity_at, context
     FROM sessions
     WHERE id = $1 AND ended_at IS NULL`,
    [sessionId]
  );

  if (result.rows.length === 0) return null;

  return {
    ...result.rows[0],
    context: result.rows[0].context,
  };
}

/**
 * Update session activity timestamp and context
 */
export async function updateSessionActivity(
  sessionId: string,
  context?: SessionContext
): Promise<void> {
  const pool = getPool();

  if (context) {
    await pool.query(
      `UPDATE sessions
       SET last_activity_at = CURRENT_TIMESTAMP, context = $2
       WHERE id = $1`,
      [sessionId, JSON.stringify(context)]
    );
  } else {
    await pool.query(
      `UPDATE sessions
       SET last_activity_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [sessionId]
    );
  }
}

// ============================================================================
// INTERACTION QUERIES
// ============================================================================

/**
 * Create new interaction record
 */
export async function createInteraction(
  sessionId: string,
  userId: string,
  query: string
): Promise<InteractionRecord> {
  const pool = getPool();

  const result = await pool.query(
    `INSERT INTO interactions (session_id, user_id, query, status)
     VALUES ($1, $2, $3, 'pending')
     RETURNING id, session_id, user_id, query, response, status, created_at`,
    [sessionId, userId, query]
  );

  return result.rows[0];
}

/**
 * Update interaction with response
 */
export async function updateInteraction(
  interactionId: string,
  response: string,
  status: 'success' | 'error',
  errorMessage?: string
): Promise<void> {
  const pool = getPool();

  await pool.query(
    `UPDATE interactions
     SET response = $2, status = $3, error_message = $4
     WHERE id = $1`,
    [interactionId, response, status, errorMessage || null]
  );
}

/**
 * Get recent interactions for a session
 */
export async function getRecentInteractions(
  sessionId: string,
  limit: number = 10
): Promise<InteractionRecord[]> {
  const pool = getPool();

  const result = await pool.query(
    `SELECT id, session_id, user_id, query, response, status, created_at
     FROM interactions
     WHERE session_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [sessionId, limit]
  );

  return result.rows;
}

// ============================================================================
// TOOL CALL QUERIES
// ============================================================================

/**
 * Log tool call execution
 */
export async function logToolCall(
  interactionId: string,
  toolName: string,
  parameters: Record<string, any>,
  result: any,
  success: boolean,
  errorMessage?: string
): Promise<ToolCallRecord> {
  const pool = getPool();

  const dbResult = await pool.query(
    `INSERT INTO tool_calls (interaction_id, tool_name, parameters, result, success, error_message)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, interaction_id, tool_name, parameters, result, success, error_message, executed_at`,
    [interactionId, toolName, JSON.stringify(parameters), JSON.stringify(result), success, errorMessage || null]
  );

  return {
    ...dbResult.rows[0],
    parameters: dbResult.rows[0].parameters,
    result: dbResult.rows[0].result,
  };
}

/**
 * Get tool calls for an interaction
 */
export async function getToolCallsForInteraction(interactionId: string): Promise<ToolCallRecord[]> {
  const pool = getPool();

  const result = await pool.query(
    `SELECT id, interaction_id, tool_name, parameters, result, success, error_message, executed_at
     FROM tool_calls
     WHERE interaction_id = $1
     ORDER BY executed_at ASC`,
    [interactionId]
  );

  return result.rows.map(row => ({
    ...row,
    parameters: row.parameters,
    result: row.result,
  }));
}

// ============================================================================
// MEETING QUERIES
// ============================================================================

/**
 * Create or update meeting record
 */
export async function saveMeeting(
  userId: string,
  meetingData: {
    title: string;
    participants: string[];
    startTime: Date;
    endTime?: Date;
    summary?: string;
    transcript?: string;
    actionItems?: string[];
    decisions?: string[];
    metadata?: Record<string, any>;
  }
): Promise<MeetingRecord> {
  const pool = getPool();

  const result = await pool.query(
    `INSERT INTO meetings (user_id, title, participants, start_time, end_time, summary, transcript, action_items, decisions, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [
      userId,
      meetingData.title,
      meetingData.participants,
      meetingData.startTime,
      meetingData.endTime || null,
      meetingData.summary || null,
      meetingData.transcript || null,
      meetingData.actionItems || [],
      meetingData.decisions || [],
      JSON.stringify(meetingData.metadata || {}),
    ]
  );

  return {
    ...result.rows[0],
    metadata: result.rows[0].metadata,
  };
}

/**
 * Get recent meetings for user
 */
export async function getRecentMeetings(userId: string, limit: number = 20): Promise<MeetingRecord[]> {
  const pool = getPool();

  const result = await pool.query(
    `SELECT * FROM meetings
     WHERE user_id = $1
     ORDER BY start_time DESC
     LIMIT $2`,
    [userId, limit]
  );

  return result.rows.map(row => ({
    ...row,
    metadata: row.metadata,
  }));
}

// ============================================================================
// MEMORY QUERIES
// ============================================================================

/**
 * Store a memory
 */
export async function storeMemory(
  userId: string,
  type: 'meeting' | 'decision' | 'action_item' | 'note',
  content: string,
  metadata?: Record<string, any>,
  relatedMeetingId?: string,
  relatedInteractionId?: string
): Promise<MemoryRecord> {
  const pool = getPool();

  const result = await pool.query(
    `INSERT INTO memories (user_id, type, content, metadata, related_meeting_id, related_interaction_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [userId, type, content, JSON.stringify(metadata || {}), relatedMeetingId || null, relatedInteractionId || null]
  );

  return {
    ...result.rows[0],
    metadata: result.rows[0].metadata,
  };
}

/**
 * Search memories by text (basic text search, will be enhanced with vectors in Phase 2)
 */
export async function searchMemories(
  userId: string,
  query: string,
  filters?: {
    type?: string;
    startDate?: Date;
    endDate?: Date;
  },
  limit: number = 10
): Promise<MemoryRecord[]> {
  const pool = getPool();

  let sql = `
    SELECT * FROM memories
    WHERE user_id = $1
    AND content ILIKE $2
  `;

  const params: any[] = [userId, `%${query}%`];
  let paramCount = 2;

  if (filters?.type) {
    paramCount++;
    sql += ` AND type = $${paramCount}`;
    params.push(filters.type);
  }

  if (filters?.startDate) {
    paramCount++;
    sql += ` AND created_at >= $${paramCount}`;
    params.push(filters.startDate);
  }

  if (filters?.endDate) {
    paramCount++;
    sql += ` AND created_at <= $${paramCount}`;
    params.push(filters.endDate);
  }

  sql += ` ORDER BY created_at DESC LIMIT $${paramCount + 1}`;
  params.push(limit);

  const result = await pool.query(sql, params);

  return result.rows.map(row => ({
    ...row,
    metadata: row.metadata,
  }));
}
