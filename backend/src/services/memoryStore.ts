/**
 * Memory Store Service
 * 
 * Provides high-level memory operations for the agent.
 * Abstracts database queries into semantic operations.
 * 
 * Phase 1: Basic text search
 * Phase 2: Will add vector embeddings and semantic search
 * 
 * Responsibilities:
 * - Store and retrieve memories
 * - Search across memory types
 * - Build context from memory
 */

import {
  storeMemory as dbStoreMemory,
  searchMemories as dbSearchMemories,
  getRecentMeetings,
} from '../db/queries';
import type { MemoryRecord, MeetingRecord } from '@meetmind/shared';

/**
 * Store a new memory
 */
export async function storeMemory(
  userId: string,
  type: 'meeting' | 'decision' | 'action_item' | 'note',
  content: string,
  metadata?: Record<string, any>
): Promise<MemoryRecord> {
  return dbStoreMemory(userId, type, content, metadata);
}

/**
 * Search memories by query string
 * Returns relevant memories based on text matching
 * 
 * TODO Phase 2: Replace with vector similarity search
 */
export async function searchMemories(
  userId: string,
  query: string,
  options?: {
    type?: 'meeting' | 'decision' | 'action_item' | 'note';
    limit?: number;
    startDate?: Date;
    endDate?: Date;
  }
): Promise<MemoryRecord[]> {
  return dbSearchMemories(
    userId,
    query,
    {
      type: options?.type,
      startDate: options?.startDate,
      endDate: options?.endDate,
    },
    options?.limit || 10
  );
}

/**
 * Get recent context for the user
 * Combines recent meetings and memories to build situational awareness
 */
export async function getRecentContext(
  userId: string,
  options?: {
    meetingLimit?: number;
    memoryLimit?: number;
  }
): Promise<{
  recentMeetings: MeetingRecord[];
  recentMemories: MemoryRecord[];
}> {
  const [recentMeetings, recentMemories] = await Promise.all([
    getRecentMeetings(userId, options?.meetingLimit || 5),
    dbSearchMemories(userId, '', {}, options?.memoryLimit || 10),
  ]);

  return {
    recentMeetings,
    recentMemories,
  };
}

/**
 * Build a context string from memories
 * Used to enhance agent's understanding of the user's situation
 */
export function buildContextString(
  meetings: MeetingRecord[],
  memories: MemoryRecord[]
): string {
  let context = '';

  if (meetings.length > 0) {
    context += 'Recent Meetings:\n';
    meetings.forEach((meeting) => {
      context += `- ${meeting.title} (${meeting.startTime.toLocaleDateString()})`;
      if (meeting.summary) {
        context += `: ${meeting.summary.substring(0, 100)}...`;
      }
      context += '\n';
    });
    context += '\n';
  }

  if (memories.length > 0) {
    context += 'Recent Memories:\n';
    memories.forEach((memory) => {
      context += `- [${memory.type}] ${memory.content.substring(0, 100)}...\n`;
    });
  }

  return context || 'No recent context available.';
}

/**
 * Extract action items from a meeting
 * Parses and stores individual action items as memories
 */
export async function extractAndStoreActionItems(
  userId: string,
  meetingId: string,
  actionItems: string[]
): Promise<MemoryRecord[]> {
  const storedItems = await Promise.all(
    actionItems.map((item) =>
      dbStoreMemory(userId, 'action_item', item, {
        meetingId,
        extractedAt: new Date().toISOString(),
      })
    )
  );

  return storedItems;
}

/**
 * Extract decisions from a meeting
 * Parses and stores individual decisions as memories
 */
export async function extractAndStoreDecisions(
  userId: string,
  meetingId: string,
  decisions: string[]
): Promise<MemoryRecord[]> {
  const storedDecisions = await Promise.all(
    decisions.map((decision) =>
      dbStoreMemory(userId, 'decision', decision, {
        meetingId,
        extractedAt: new Date().toISOString(),
      })
    )
  );

  return storedDecisions;
}
