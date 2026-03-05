/**
 * MeetMind Backend Server
 * 
 * This is the main entry point for the MeetMind backend.
 * It initializes the Fastify server, registers routes, and starts listening.
 * 
 * Architecture:
 * - Fastify for HTTP server
 * - PostgreSQL for persistence
 * - OpenAI for agent reasoning- n8n for tool execution
 */

import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { config } from 'dotenv';
import { agentRoutes } from './routes/agent';
import { initDatabase } from './db/schema';
import { getProviderInfo } from './services/llm';

// Load environment variables
config();

/**
 * Create and configure Fastify server instance
 */
async function createServer() {
  const fastify = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
      transport: {
        target: 'pino-pretty',
        options: {
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname',
        },
      },
    },
  });

  // Register CORS for Chrome extension
  await fastify.register(cors, {
    origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
  });

  // Health check endpoint
  fastify.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  // Register agent routes
  await fastify.register(agentRoutes, { prefix: '/agent' });

  return fastify;
}

/**
 * Start the server
 */
async function start() {
  try {
    // Initialize database connection
    console.log('Initializing database...');
    await initDatabase();
    console.log('Database initialized successfully');

    // Create server instance
    const fastify = await createServer();

    // Start listening
    const port = parseInt(process.env.PORT || '3000', 10);
    const host = process.env.HOST || '0.0.0.0';

    await fastify.listen({ port, host });

    const providerInfo = getProviderInfo();
    
    fastify.log.info(`🚀 MeetMind backend running on http://${host}:${port}`);
    fastify.log.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    fastify.log.info(`🤖 LLM Provider: ${providerInfo.provider.toUpperCase()} (${providerInfo.model})${providerInfo.baseUrl ? ` @ ${providerInfo.baseUrl}` : ''}`);
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

// Start the server
start();
