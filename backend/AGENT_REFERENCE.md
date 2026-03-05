# Agent Core - Quick Reference

This document provides a quick reference for understanding the Phase 1B agent execution loop.

## Agent States

```
INITIALIZING
    ↓
REASONING (calls OpenAI)
    ↓
EXECUTING_TOOLS (if tools needed)
    ↓
REASONING (next iteration)
    ↓
FINALIZING (when done)
```

### State Enum
```typescript
enum AgentState {
  INITIALIZING = "initializing",
  REASONING = "reasoning",
  EXECUTING_TOOLS = "executing_tools",
  FINALIZING = "finalizing",
  ERROR = "error"
}
```

---

## Decision Types

The agent normalizes OpenAI responses into three decision types:

### 1. FINAL
**Meaning:** Agent has completed the task  
**Response contains:** Final message to user  
**Next state:** FINALIZING  
**Iteration:** Ends loop  

**Example:**
```json
{
  "type": "final_response",
  "message": "Meeting scheduled successfully"
}
```

### 2. TOOL_CALL
**Meaning:** Agent needs to execute tools  
**Response contains:** Array of tool calls  
**Next state:** EXECUTING_TOOLS  
**Iteration:** Continues  

**Example:**
```json
{
  "type": "tool_call",
  "tool_calls": [
    {
      "id": "call_abc123",
      "function": {
        "name": "create_calendar_event",
        "arguments": "{...}"
      }
    }
  ]
}
```

### 3. NEEDS_INPUT
**Meaning:** Agent needs clarification  
**Response contains:** Clarification question  
**Next state:** FINALIZING  
**Iteration:** Ends loop  

**Example:**
```json
{
  "type": "needs_input",
  "message": "When should I schedule the meeting?",
  "clarification": "I need the date and time"
}
```

---

## Execution Flow

### 1. Initialization
```typescript
// Create database records
const user = await findOrCreateUser(email, name);
const session = await ensureActiveSession(user.id);
const interaction = await createInteraction(session.id, query);

// Set initial state
let currentState = AgentState.INITIALIZING;
const startTime = Date.now();
```

### 2. Main Loop
```typescript
for (let iteration = 1; iteration <= MAX_ITERATIONS; iteration++) {
  currentState = AgentState.REASONING;
  
  // Call OpenAI
  const decision = await callOpenAI(messages, tools);
  
  // Normalize decision
  const normalizedDecision = normalizeDecision(decision);
  
  // Execute based on decision type
  switch (normalizedDecision) {
    case AgentDecisionType.FINAL:
      // Done!
      break;
    
    case AgentDecisionType.TOOL_CALL:
      // Execute tools
      currentState = AgentState.EXECUTING_TOOLS;
      const results = await executeTools(decision.tool_calls);
      messages.push(results); // Add to context
      // Continue to next iteration
      break;
    
    case AgentDecisionType.NEEDS_INPUT:
      // Ask user for clarification
      break;
  }
}
```

### 3. Tool Execution (Defensive)
```typescript
for (const toolCall of tool_calls) {
  // 1. Try to parse arguments
  let parameters;
  try {
    parameters = JSON.parse(toolCall.function.arguments);
  } catch (err) {
    // LOG FAILURE - invalid arguments
    await logToolCall(interactionId, toolName, {}, false, "Parse error");
    continue;
  }
  
  // 2. Try to execute tool
  let result;
  try {
    result = await executeTool(toolName, parameters);
  } catch (err) {
    // LOG FAILURE - execution error
    await logToolCall(interactionId, toolName, parameters, false, err.message);
    continue;
  }
  
  // 3. Validate result structure
  if (!result || typeof result.success !== 'boolean') {
    // LOG FAILURE - invalid result
    await logToolCall(interactionId, toolName, parameters, false, "Invalid result");
    continue;
  }
  
  // 4. LOG SUCCESS OR FAILURE
  try {
    await logToolCall(
      interactionId,
      toolName,
      parameters,
      result.success,
      result.error || null
    );
  } catch (dbErr) {
    // Database logging failed - continue anyway
    console.error("[AGENT] Failed to log tool call:", dbErr.message);
  }
}
```

---

## Safety Constraints

### Max Iterations
```typescript
const MAX_ITERATIONS = 5;

if (iteration > MAX_ITERATIONS) {
  throw new Error("Max iterations reached");
}
```

**Purpose:** Prevent infinite loops  
**Behavior:** Agent stops after 5 iterations  
**Response:** Returns error to user  

### Max Tools Per Iteration
```typescript
const MAX_TOOLS_PER_ITERATION = 10;

if (tool_calls.length > MAX_TOOLS_PER_ITERATION) {
  throw new Error(`Too many tool calls: ${tool_calls.length}`);
}
```

**Purpose:** Prevent runaway tool execution  
**Behavior:** Rejects iterations with >10 tools  
**Response:** Returns error to user  

---

## Logging Pattern

### Console Logs (Structured)
```typescript
console.log(`[AGENT] Starting execution for user ${userId}`);
console.log(`[AGENT] Query: "${query}"`);
console.log(`[AGENT] === Iteration ${iteration}/${MAX_ITERATIONS} ===`);
console.log(`[AGENT] State: ${currentState}`);
console.log(`[AGENT] Normalized decision: ${normalizedDecision}`);
console.log(`[AGENT] Executing tool: ${toolName}`);
console.log(`[AGENT] Tool ${toolName} result: ${result.success ? 'SUCCESS' : 'FAILURE'}`);
console.log(`[AGENT] Total execution time: ${executionTime}ms`);
```

**Prefix:** Always `[AGENT]`  
**Purpose:** Easy to filter logs, clear context  
**Level:** Info (normal flow), Error (failures)  

### Database Logs (Audit Trail)

**interactions table:**
```sql
INSERT INTO interactions (
  session_id,
  query,
  response,
  status,
  error_message,
  created_at,
  updated_at
) VALUES (...);
```

**tool_calls table:**
```sql
INSERT INTO tool_calls (
  interaction_id,
  tool_name,
  input_parameters,
  result_data,
  success,
  error_message,
  executed_at
) VALUES (...);
```

**When logged:**
- Interaction: Created at start, updated at end
- Tool calls: Logged BEFORE execution (with result after)

**What's captured:**
- Every tool execution (success or failure)
- All errors and error messages
- Full parameters and results
- Exact timestamps

---

## Error Handling

### Tool Argument Parsing Error
```typescript
try {
  parameters = JSON.parse(toolCall.function.arguments);
} catch (err) {
  console.error(`[AGENT] Failed to parse arguments for ${toolName}:`, err.message);
  await logToolCall(interactionId, toolName, {}, false, "Failed to parse arguments");
  continue; // Skip this tool, continue with others
}
```

### Tool Execution Error
```typescript
try {
  result = await executeTool(toolName, parameters);
} catch (err) {
  console.error(`[AGENT] Tool ${toolName} execution failed:`, err.message);
  await logToolCall(interactionId, toolName, parameters, false, err.message);
  continue; // Skip this tool, continue with others
}
```

### Tool Result Validation Error
```typescript
if (!result || typeof result.success !== 'boolean') {
  console.error(`[AGENT] Tool ${toolName} returned invalid result structure`);
  await logToolCall(interactionId, toolName, parameters, false, "Invalid result structure");
  continue;
}
```

### Database Logging Error
```typescript
try {
  await logToolCall(...);
} catch (dbErr) {
  console.error(`[AGENT] Failed to log tool call to database:`, dbErr.message);
  // Don't throw - continue execution
}
```

### Critical Error (Kills Execution)
```typescript
catch (err) {
  console.error("==========================================");
  console.error("CRITICAL ERROR IN AGENT EXECUTION");
  console.error("==========================================");
  console.error("Error:", err.message);
  console.error("Stack:", err.stack);
  console.error("State at error:", currentState);
  console.error("Iteration at error:", iteration);
  
  // Try to log to database
  try {
    await updateInteractionOutcome(interactionId, "error", null, err.message);
  } catch (dbErr) {
    console.error("Failed to log error to database:", dbErr.message);
  }
  
  throw err; // Re-throw to return 500 to client
}
```

---

## Response Structure

### Success
```typescript
{
  status: "success",
  message: "Task completed successfully",
  actions: [
    {
      toolName: "create_calendar_event",
      parameters: {...},
      success: true,
      timestamp: "2024-03-01T10:00:00Z"
    }
  ]
}
```

### Needs Confirmation
```typescript
{
  status: "requires_confirmation",
  message: "I need more information to proceed",
  requiresConfirmation: true,
  confirmationPrompt: "When should I schedule the meeting?",
  actions: []
}
```

### Error
```typescript
{
  status: "error",
  message: "Max iterations reached. Unable to complete task.",
  actions: []
}
```

---

## Common Debug Scenarios

### Agent loops but doesn't finish
**Check:** MAX_ITERATIONS reached?  
**Log:** `[AGENT] === Iteration 5/5 ===`  
**Solution:** Investigate why agent isn't reaching FINAL state

### Tool not executing
**Check:** Is tool in registry?  
**Log:** `[AGENT] Executing tool: <name>`  
**Solution:** Ensure tool is registered in toolRegistry.ts

### Tool fails silently
**Check:** Database tool_calls table  
**Log:** `[AGENT] Tool <name> result: FAILURE`  
**Solution:** Check error_message in database

### No response from agent
**Check:** Backend logs for errors  
**Log:** `CRITICAL ERROR IN AGENT EXECUTION`  
**Solution:** Check stack trace and state at error

### Arguments parse error
**Check:** OpenAI returning valid JSON?  
**Log:** `Failed to parse arguments for <tool>`  
**Solution:** Verify tool definition schema matches OpenAI's function calling format

---

## Testing Checklist

- [ ] Agent completes simple queries (1 iteration, no tools)
- [ ] Agent executes single tool correctly
- [ ] Agent executes multiple tools in sequence
- [ ] Agent handles missing information (NEEDS_INPUT)
- [ ] Agent handles tool failures gracefully
- [ ] Agent respects MAX_ITERATIONS
- [ ] Agent respects MAX_TOOLS_PER_ITERATION
- [ ] All tool calls logged to database
- [ ] Errors logged to database
- [ ] Console logs are structured and complete
- [ ] Response structure is always consistent

---

## Key Principles

1. **Deterministic:** Same input should produce same execution flow
2. **Defensive:** Never assume success - always validate
3. **Observable:** Log everything for debugging
4. **Safe:** Hard limits prevent runaway execution
5. **Recoverable:** Errors logged, execution continues when possible
6. **Traceable:** Complete audit trail in database

---

## Quick Debugging Commands

### Check recent interactions
```sql
SELECT * FROM interactions ORDER BY created_at DESC LIMIT 10;
```

### Check tool calls for an interaction
```sql
SELECT * FROM tool_calls WHERE interaction_id = '<uuid>' ORDER BY executed_at;
```

### Count tool success/failure
```sql
SELECT tool_name, success, COUNT(*) 
FROM tool_calls 
GROUP BY tool_name, success;
```

### Find failed tools
```sql
SELECT tool_name, error_message, COUNT(*) 
FROM tool_calls 
WHERE NOT success 
GROUP BY tool_name, error_message;
```

### Check agent loop iterations
```bash
# In backend logs
grep "\[AGENT\] === Iteration" logs.txt
```

### Check decision types
```bash
# In backend logs
grep "Normalized decision:" logs.txt
```

---

For comprehensive testing, see [TESTING_PHASE1B.md](../TESTING_PHASE1B.md).
