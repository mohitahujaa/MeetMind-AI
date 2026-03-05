/**
 * Agent Core - The Reasoning and Execution Loop (Phase 1B)
 * 
 * This is the heart of MeetMind's intelligence.
 * It implements a deterministic, single-agent execution loop.
 * 
 * EXECUTION FLOW:
 * 1. Receive user query + context
 * 2. Inject system prompt with memory context
 * 3. Inject all available tool definitions
 * 4. Call LLM (OpenAI GPT-4) with tools
 * 5. Detect decision type:
 *    - FINAL: Agent completed task → return response
 *    - TOOL_CALL: Agent needs tools → execute and loop to step 4
 *    - NEEDS_INPUT: Agent needs clarification → return prompt
 * 6. If TOOL_CALL:
 *    - Parse tool arguments (never assume valid)
 *    - Execute tool (never assume success)
 *    - Log tool call to database (always, even on failure)
 *    - Append result to conversation
 *    - Return to step 4
 * 7. Return normalized structured response
 * 
 * ARCHITECTURE PRINCIPLES:
 * - Stateless per request (all state in DB)
 * - Deterministic execution (explicit state machine)
 * - Full logging (every action tracked)
 * - Defensive programming (never assume success)
 * - Graceful degradation (errors don't crash)
 * 
 * SAFETY CONSTRAINTS:
 * - Max iterations: 5 (prevents infinite loops)
 * - Max tools per iteration: 10 (prevents runaway execution)
 * - All tool calls logged before execution
 * - Interaction outcome always recorded
 * 
 * OUTPUT STATES (Normalized):
 * - FINAL: Task complete
 * - TOOL_CALL: Executing tools
 * - NEEDS_INPUT: Requires clarification
 * - ERROR: Execution failed
 */

import type {
  AgentRequest,
  AgentResponse,
  OpenAIMessage,
  ToolCall,
  ExecutedAction,
} from '@meetmind/shared';

// LLM Service - Unified interface for all providers (OpenAI, Google AI, Ollama)
// Switch providers by setting LLM_PROVIDER in .env (openai|googleai|ollama)
import { callLLM, createSystemMessage, getProviderInfo } from '../services/llm';

import { getAllToolDefinitions, executeTool } from './toolRegistry';
import { getRecentContext, buildContextString } from '../services/memoryStore';
import {
  createInteraction,
  updateInteraction,
  logToolCall,
  updateSessionActivity,
  getRecentInteractions,
  getToolCallsForInteraction,
} from '../db/queries';

/**
 * Maximum number of agent loop iterations
 * Prevents infinite loops
 */
const MAX_ITERATIONS = 5;

/**
 * Maximum number of tool calls per iteration
 * Prevents runaway tool execution
 */
const MAX_TOOLS_PER_ITERATION = 10;

/**
 * Agent execution state
 * Explicitly tracks what the agent is doing
 */
enum AgentState {
  INITIALIZING = 'INITIALIZING',
  REASONING = 'REASONING',
  EXECUTING_TOOLS = 'EXECUTING_TOOLS',
  FINALIZING = 'FINALIZING',
  ERROR = 'ERROR',
}

/**
 * Agent decision type - normalized output states
 */
enum AgentDecisionType {
  FINAL = 'FINAL',           // Agent has completed the task
  TOOL_CALL = 'TOOL_CALL',   // Agent needs to execute tools
  NEEDS_INPUT = 'NEEDS_INPUT', // Agent needs clarification
}

/**
 * Main agent execution function
 * This is called from the API route
 */
export async function runAgent(request: AgentRequest): Promise<AgentResponse> {
  const { userId, sessionId, query, context } = request;

  // Track agent state for deterministic execution
  let currentState: AgentState = AgentState.INITIALIZING;
  
  // Execution metadata
  const startTime = Date.now();
  let interactionId: string | null = null;
  
  // Track executed actions for response (declared here so accessible in catch block)
  const executedActions: ExecutedAction[] = [];

  try {
    console.log(`[AGENT] Starting execution for user ${userId}`);
    console.log(`[AGENT] Query: "${query}"`);
    
    // Log active LLM provider
    const providerInfo = getProviderInfo();
    console.log(`[AGENT] LLM Provider: ${providerInfo.provider} (${providerInfo.model})${providerInfo.baseUrl ? ` @ ${providerInfo.baseUrl}` : ''}`);
    
    // Update session activity
    await updateSessionActivity(sessionId, context);

    // Create interaction record - this happens FIRST for full traceability
    const interaction = await createInteraction(sessionId, userId, query);
    interactionId = interaction.id;
    
    console.log(`[AGENT] Created interaction ${interactionId}`);

    // Build context from memory
    const recentContext = await getRecentContext(userId);
    const contextString = buildContextString(
      recentContext.recentMeetings,
      recentContext.recentMemories
    );

    // Retrieve recent conversation history for this session
    const recentInteractions = await getRecentInteractions(sessionId, 5);
    
    // Initialize conversation messages with system prompt
    const messages: OpenAIMessage[] = [
      createSystemMessage(contextString),
    ];

    // Build conversation history from previous interactions (oldest first)
    const previousConversation = recentInteractions.reverse();
    for (const prevInteraction of previousConversation) {
      // Add previous user query
      messages.push({
        role: 'user',
        content: prevInteraction.query,
      });
      
      // Retrieve tool calls for this interaction to provide full context
      const toolCalls = await getToolCallsForInteraction(prevInteraction.id);
      
      console.log(`[AGENT] Retrieved ${toolCalls.length} tool calls for previous interaction ${prevInteraction.id}`);
      
      // If there were tool executions, add them to the conversation context
      if (toolCalls.length > 0) {
        // Build a summary of tool executions for context
        const toolSummary = toolCalls.map(tc => {
          const params = tc.parameters ? JSON.stringify(tc.parameters) : '{}';
          const result = tc.result ? JSON.stringify(tc.result) : '{}';
          return `Tool: ${tc.toolName}\nParameters: ${params}\nResult: ${result}`;
        }).join('\n\n');
        
        console.log(`[AGENT] Adding tool execution context to messages:\n${toolSummary.substring(0, 200)}...`);
        
        // Add tool execution context as an assistant message
        messages.push({
          role: 'assistant',
          content: `[Previous tool executions]\n${toolSummary}`,
        });
      }
      
      // Add previous assistant response if available
      if (prevInteraction.response && prevInteraction.status === 'success') {
        messages.push({
          role: 'assistant',
          content: prevInteraction.response,
        });
      }
    }
    
    // Add current user query
    messages.push({
      role: 'user',
      content: query,
    });
    
    console.log(`[AGENT] Including ${previousConversation.length} previous interactions in context`);

    // Add session context if available
    if (context.url || context.selectedText) {
      const contextInfo: string[] = [];
      if (context.url) contextInfo.push(`Current URL: ${context.url}`);
      if (context.pageTitle) contextInfo.push(`Page Title: ${context.pageTitle}`);
      if (context.selectedText) contextInfo.push(`Selected Text: ${context.selectedText}`);

      messages.push({
        role: 'system',
        content: `Additional context:\n${contextInfo.join('\n')}`,
      });
    }

    // Agent loop - deterministic execution with explicit state tracking
    let iteration = 0;
    let continueLoop = true;
    let finalMessage = '';
    
    // Track executed tool calls to prevent duplicates
    const executedToolSignatures = new Set<string>();
    let totalToolCalls = 0; // Track total tool calls across all iterations

    currentState = AgentState.REASONING;

    while (continueLoop && iteration < MAX_ITERATIONS) {
      iteration++;

      console.log(`[AGENT] === Iteration ${iteration}/${MAX_ITERATIONS} ===`);
      console.log(`[AGENT] State: ${currentState}`);
      console.log(`[AGENT] Messages in context: ${messages.length}`);
      console.log(`[AGENT] Total tool calls so far: ${totalToolCalls}`);

      // Get tool definitions
      const tools = getAllToolDefinitions();

      // Call LLM - this is a blocking call
      console.log(`[AGENT] Calling LLM with ${tools.length} available tools...`);
      const decision = await callLLM(messages, tools);
      console.log(`[AGENT] LLM decision type: ${decision.type}`);

      // Normalize decision type to explicit states
      let normalizedDecision: AgentDecisionType;
      
      if (decision.type === 'final_response') {
        normalizedDecision = AgentDecisionType.FINAL;
      } else if (decision.type === 'tool_calls') {
        normalizedDecision = AgentDecisionType.TOOL_CALL;
      } else if (decision.type === 'clarification') {
        normalizedDecision = AgentDecisionType.NEEDS_INPUT;
      } else {
        // Unknown state - treat as final
        console.warn(`[AGENT] Unknown decision type: ${decision.type}`);
        normalizedDecision = AgentDecisionType.FINAL;
      }

      console.log(`[AGENT] Normalized decision: ${normalizedDecision}`);

      // Process based on normalized decision type
      switch (normalizedDecision) {
        case AgentDecisionType.FINAL:
          // Agent has finished reasoning - TERMINAL STATE
          currentState = AgentState.FINALIZING;
          finalMessage = decision.message || 'Task completed.';
          continueLoop = false;
          
          console.log(`[AGENT] Final response received`);
          console.log(`[AGENT] Message: "${finalMessage.substring(0, 100)}..."`);
          break;

        case AgentDecisionType.TOOL_CALL:
          // Agent wants to execute tools
          currentState = AgentState.EXECUTING_TOOLS;
          
          if (!decision.toolCalls || decision.toolCalls.length === 0) {
            console.error('[AGENT] TOOL_CALL decision but no tool calls provided');
            finalMessage = 'Internal error: Tool execution requested but no tools specified.';
            continueLoop = false;
            currentState = AgentState.ERROR;
            break;
          }

          // Safety check: prevent too many tool calls
          if (decision.toolCalls.length > MAX_TOOLS_PER_ITERATION) {
            console.warn(`[AGENT] Too many tool calls requested: ${decision.toolCalls.length}`);
            finalMessage = `Too many tools requested in one step (${decision.toolCalls.length}). Please simplify your request.`;
            continueLoop = false;
            currentState = AgentState.ERROR;
            break;
          }

          console.log(`[AGENT] Executing ${decision.toolCalls.length} tool(s):`);
          decision.toolCalls.forEach((tc, idx) => {
            console.log(`[AGENT]   ${idx + 1}. ${tc.function.name}`);
          });

          // Add assistant message with tool calls to conversation
          // This is REQUIRED for OpenAI's function calling API
          messages.push({
            role: 'assistant',
            content: null,
            tool_calls: decision.toolCalls,
          });

          // Execute each tool sequentially (deterministic order)
          for (const toolCall of decision.toolCalls) {
            const toolName = toolCall.function.name;
            let parameters: any;

            // Parse tool arguments - NEVER assume success
            try {
              parameters = JSON.parse(toolCall.function.arguments);
              console.log(`[AGENT] Parsed parameters for ${toolName}:`, parameters);
            } catch (error) {
              console.error(`[AGENT] Failed to parse arguments for ${toolName}:`, toolCall.function.arguments);
              parameters = {};
              
              // Log failed parsing attempt to database
              await logToolCall(
                interaction.id,
                toolName,
                {},
                null,
                false,
                'Failed to parse tool arguments'
              );
              
              // Add error result to messages for OpenAI context
              messages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: JSON.stringify({
                  success: false,
                  error: 'Failed to parse tool arguments'
                }),
              });
              
              // Skip this tool and continue with next
              continue;
            }
            
            // Check for duplicate tool calls with same parameters
            const toolSignature = `${toolName}:${JSON.stringify(parameters)}`;
            if (executedToolSignatures.has(toolSignature)) {
              console.log(`[AGENT] Skipping duplicate tool call: ${toolName} with same parameters`);
              
              // Return cached-like response
              messages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: JSON.stringify({
                  success: true,
                  message: 'This exact tool call was already executed in this interaction.',
                  cached: true
                }),
              });
              
              continue;
            }
            
            // Mark this tool signature as executed
            executedToolSignatures.add(toolSignature);

            // Execute the tool - NEVER assume success
            let result;
            try {
              result = await executeTool(toolName, userId, parameters);
            } catch (error) {
              console.error(`[AGENT] Tool ${toolName} execution failed:`, error);
              result = {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error during tool execution',
              };
            }

            // Validate result structure
            if (!result || typeof result.success !== 'boolean') {
              console.error(`[AGENT] Tool ${toolName} returned invalid result:`, result);
              result = {
                success: false,
                error: 'Tool returned invalid result structure',
              };
            }

            console.log(`[AGENT] Tool ${toolName} result: ${result.success ? 'SUCCESS' : 'FAILURE'}`);
            if (!result.success && result.error) {
              console.error(`[AGENT] Tool error: ${result.error}`);
            }

            // Log to database - ALWAYS log, even on failure
            try {
              await logToolCall(
                interaction.id,
                toolName,
                parameters,
                result.data || null,
                result.success,
                result.error
              );
            } catch (dbError) {
              console.error(`[AGENT] Failed to log tool call to database:`, dbError);
              // Continue execution even if logging fails
            }

            // Track for response
            executedActions.push({
              toolName,
              parameters,
              result: result.data,
              timestamp: new Date(),
              success: result.success,
              errorMessage: result.error,
            });

            // Add tool result to conversation - REQUIRED for OpenAI
            messages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: JSON.stringify(result),
            });

            totalToolCalls++;
          }

          console.log(`[AGENT] Completed tool execution batch. Total tools executed: ${totalToolCalls}`);
          
          // Continue loop to get agent's next decision
          currentState = AgentState.REASONING;
          break;

        case AgentDecisionType.NEEDS_INPUT:
          // Agent needs more information - TERMINAL STATE
          currentState = AgentState.FINALIZING;
          finalMessage = decision.message || 'I need more information to proceed.';
          continueLoop = false;

          console.log(`[AGENT] Clarification requested: "${finalMessage}"`);

          // Update interaction as requiring clarification
          await updateInteraction(
            interaction.id,
            finalMessage,
            'success' // Not an error, just needs user input
          );

          const executionTime = Date.now() - startTime;
          console.log(`[AGENT] Execution completed in ${executionTime}ms`);
          console.log(`[AGENT] Total iterations: ${iteration}`);
          console.log(`[AGENT] Total tool calls: ${totalToolCalls}`);

          return {
            status: 'requires_confirmation',
            message: finalMessage,
            actions: executedActions,
            requiresConfirmation: true,
            confirmationPrompt: finalMessage,
          };
      }
    }

    // Check if we hit max iterations
    if (iteration >= MAX_ITERATIONS && continueLoop) {
      finalMessage = 'I apologize, but I reached the maximum number of reasoning steps. Please try breaking down your request.';
      
      await updateInteraction(
        interaction.id,
        finalMessage,
        'error',
        'Max iterations reached'
      );

      return {
        status: 'error',
        message: finalMessage,
        actions: executedActions,
      };
    }

    // Update interaction with final response
    await updateInteraction(interaction.id, finalMessage, 'success');

    // Return final response
    return {
      status: 'success',
      message: finalMessage,
      actions: executedActions,
    };
  } catch (error) {
    console.error('Agent execution error:', error);

    // If we executed tools successfully before the error, provide a helpful fallback
    if (executedActions.length > 0) {
      const successfulTools = executedActions.filter((a: ExecutedAction) => a.success);
      
      if (successfulTools.length > 0) {
        // Generate a simple response based on successful tool executions
        const toolNames = successfulTools.map((a: ExecutedAction) => a.toolName).join(', ');
        const fallbackMessage = `I successfully executed ${successfulTools.length} action(s) (${toolNames}), but encountered an error generating the final response. The actions have been completed.`;
        
        return {
          status: 'partial_success' as any, // Type assertion for new status
          message: fallbackMessage,
          actions: executedActions,
        };
      }
    }

    return {
      status: 'error',
      message: 'An error occurred while processing your request. Please try again.',
      actions: [],
    };
  }
}

/**
 * Validate agent request
 */
export function validateAgentRequest(request: any): request is AgentRequest {
  if (!request.userId || typeof request.userId !== 'string') {
    return false;
  }

  if (!request.sessionId || typeof request.sessionId !== 'string') {
    return false;
  }

  if (!request.query || typeof request.query !== 'string') {
    return false;
  }

  if (!request.context || typeof request.context !== 'object') {
    return false;
  }

  return true;
}

/**
 * Create execution summary for logging/debugging
 */
export interface AgentExecutionSummary {
  totalIterations: number;
  totalToolCalls: number;
  executionTimeMs: number;
  finalState: string;
  toolsExecuted: string[];
  successfulTools: number;
  failedTools: number;
}

/**
 * Generate summary from executed actions
 */
export function generateExecutionSummary(
  actions: ExecutedAction[],
  iterations: number,
  executionTimeMs: number,
  finalState: string
): AgentExecutionSummary {
  const toolsExecuted = actions.map(a => a.toolName);
  const successfulTools = actions.filter(a => a.success).length;
  const failedTools = actions.filter(a => !a.success).length;

  return {
    totalIterations: iterations,
    totalToolCalls: actions.length,
    executionTimeMs,
    finalState,
    toolsExecuted,
    successfulTools,
    failedTools,
  };
}

