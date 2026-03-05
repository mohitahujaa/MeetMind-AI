/**
 * Agent API Routes
 * 
 * HTTP endpoints for agent execution.
 * This is the interface between the Chrome extension and the agent core.
 * 
 * Endpoints:
 * - POST /agent/run - Execute agent with user query
 * - GET /agent/session/:sessionId - Get session info
 * - POST /agent/session - Create new session
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { AgentRequest, SessionContext } from '@meetmind/shared';
import { runAgent, validateAgentRequest } from '../agent/core';
import { createSession, getSession } from '../db/queries';
import { findOrCreateUser } from '../db/queries';
import { nanoid } from 'nanoid';

/**
 * Request body for /agent/run
 */
interface RunAgentBody {
  userId?: string;
  userEmail?: string;
  userName?: string;
  sessionId?: string;
  query: string;
  context: SessionContext;
}

/**
 * Request body for /agent/session
 */
interface CreateSessionBody {
  userId?: string;
  userEmail?: string;
  userName?: string;
  context?: SessionContext;
}

/**
 * Register agent routes
 */
export async function agentRoutes(fastify: FastifyInstance) {
  /**
   * POST /agent/run
   * Main endpoint for agent execution
   */
  fastify.post<{ Body: RunAgentBody }>(
    '/run',
    async (request: FastifyRequest<{ Body: RunAgentBody }>, reply: FastifyReply) => {
      try {
        const { userId, userEmail, userName, sessionId, query, context } = request.body;

        // Validate required fields
        if (!query) {
          return reply.status(400).send({
            status: 'error',
            message: 'Missing required field: query',
          });
        }

        if (!context) {
          return reply.status(400).send({
            status: 'error',
            message: 'Missing required field: context',
          });
        }

        // Get or create user
        let actualUserId = userId;
        if (!actualUserId) {
          if (!userEmail || !userName) {
            return reply.status(400).send({
              status: 'error',
              message: 'Either userId or (userEmail and userName) must be provided',
            });
          }

          const user = await findOrCreateUser(userEmail, userName);
          actualUserId = user.id;
        }

        // Get or create session
        let actualSessionId = sessionId;
        if (!actualSessionId) {
          const session = await createSession(actualUserId, context);
          actualSessionId = session.id;
        } else {
          // Verify session exists
          const session = await getSession(actualSessionId);
          if (!session) {
            return reply.status(404).send({
              status: 'error',
              message: 'Session not found',
            });
          }
        }

        // Build agent request
        const agentRequest: AgentRequest = {
          userId: actualUserId,
          sessionId: actualSessionId,
          query,
          context,
        };

        // Validate request
        if (!validateAgentRequest(agentRequest)) {
          return reply.status(400).send({
            status: 'error',
            message: 'Invalid agent request',
          });
        }

        // Run agent
        fastify.log.info(`Running agent for user ${actualUserId}, query: ${query}`);
        const response = await runAgent(agentRequest);

        // Return response
        return reply.send(response);
      } catch (error) {
        fastify.log.error('Agent run error:', error);
        return reply.status(500).send({
          status: 'error',
          message: 'Internal server error',
        });
      }
    }
  );

  /**
   * POST /agent/session
   * Create a new session
   */
  fastify.post<{ Body: CreateSessionBody }>(
    '/session',
    async (request: FastifyRequest<{ Body: CreateSessionBody }>, reply: FastifyReply) => {
      try {
        const { userId, userEmail, userName, context } = request.body;

        // Get or create user
        let actualUserId = userId;
        if (!actualUserId) {
          if (!userEmail || !userName) {
            return reply.status(400).send({
              status: 'error',
              message: 'Either userId or (userEmail and userName) must be provided',
            });
          }

          const user = await findOrCreateUser(userEmail, userName);
          actualUserId = user.id;
        }

        // Create session
        const session = await createSession(actualUserId, context || {});

        return reply.send({
          status: 'success',
          session: {
            id: session.id,
            userId: session.userId,
            startedAt: session.startedAt,
          },
        });
      } catch (error) {
        fastify.log.error('Session creation error:', error);
        return reply.status(500).send({
          status: 'error',
          message: 'Failed to create session',
        });
      }
    }
  );

  /**
   * GET /agent/session/:sessionId
   * Get session information
   */
  fastify.get<{ Params: { sessionId: string } }>(
    '/session/:sessionId',
    async (request: FastifyRequest<{ Params: { sessionId: string } }>, reply: FastifyReply) => {
      try {
        const { sessionId } = request.params;

        const session = await getSession(sessionId);

        if (!session) {
          return reply.status(404).send({
            status: 'error',
            message: 'Session not found',
          });
        }

        return reply.send({
          status: 'success',
          session: {
            id: session.id,
            userId: session.userId,
            startedAt: session.startedAt,
            lastActivityAt: session.lastActivityAt,
            context: session.context,
          },
        });
      } catch (error) {
        fastify.log.error('Get session error:', error);
        return reply.status(500).send({
          status: 'error',
          message: 'Failed to retrieve session',
        });
      }
    }
  );

  /**
   * GET /agent/tools
   * List available tools (useful for debugging/docs)
   */
  fastify.get('/tools', async (request, reply) => {
    try {
      const { getAvailableToolNames } = await import('../agent/toolRegistry');
      const toolNames = getAvailableToolNames();

      return reply.send({
        status: 'success',
        tools: toolNames,
        count: toolNames.length,
      });
    } catch (error) {
      fastify.log.error('Get tools error:', error);
      return reply.status(500).send({
        status: 'error',
        message: 'Failed to retrieve tools',
      });
    }
  });
}
