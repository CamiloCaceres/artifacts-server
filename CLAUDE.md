# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development
```bash
npm run dev      # Start development server with hot-reload (ts-node-dev)
npm run build    # Compile TypeScript to JavaScript
npm run start    # Run production server (requires build)
npm run watch-ts # Watch mode for TypeScript compilation
```

### Environment Setup
Create `.env` file with:
```
API_TOKEN=your_artifactsmmo_api_token_here
PORT=3001  # Optional, defaults to 3001
```

## Architecture

### Event-Driven Communication Pattern
The entire application uses EventEmitter for component communication:
- `BotManager` extends EventEmitter and broadcasts: 'statusUpdate', 'log', 'configUpdate'
- `GameBot` instances emit events consumed by BotManager
- Socket.IO server listens to BotManager events and forwards to connected clients

### Service Initialization Order
Critical: Services must be initialized before BotManager creation:
```typescript
// Correct order in index.ts:
await MonsterService.getInstance();  // Must be first
await ResourceService.getInstance(); // Must be second
const botManager = new BotManager(); // Can now create bots
```

### Bot Lifecycle Management
- Bots are recreated on configuration updates (not updated in-place)
- Each bot runs an independent async loop with try-catch error handling
- Bot status includes deep-copied Maps to avoid reference issues

### API Client Pattern
All API calls go through `apiClient.ts` which:
- Centralizes error handling and logging
- Implements cooldown management (tracks per character)
- Returns typed responses using interfaces from `types/index.ts`

### Singleton Services
`MonsterService` and `ResourceService` use singleton pattern:
- Cache all game locations on first load
- Provide synchronous lookups after initialization
- Share data across all bot instances

## Non-Obvious Patterns

### Bot Configuration Updates
When updating bot config via WebSocket:
1. Bot is completely stopped and removed
2. New bot instance is created with updated config
3. This ensures clean state but means in-progress actions are lost

### Cooldown Management
- API returns cooldown info in responses
- Bot waits for `cooldown_at` timestamp before next action
- Additional 3500ms delay added for bank operations (hardcoded)

### Inventory Management
- Bots auto-deposit when inventory reaches 90% capacity
- Crafting bots calculate exact space needed before withdrawing
- Fighting/gathering bots rest at different HP thresholds (50% vs 30%)

### Status Broadcasting
- Status updates include statistics (XP, gold, items collected)
- Logs are capped at 1000 entries to prevent memory issues
- All Maps in status are deep-copied to avoid serialization issues

## TypeScript Specifics

### Strict Mode Enabled
The project uses TypeScript strict mode - ensure:
- All variables have explicit types or can be inferred
- No implicit any types
- Null/undefined checks are required

### Module Resolution
- Using CommonJS modules (not ES modules)
- Absolute imports from 'src' directory not configured
- Use relative imports: `'./services/monsterService'`

## Common Tasks

### Adding a New Bot Action Type
1. Update `ActionType` in `types/index.ts`
2. Add handler in `GameBot.performAction()`
3. Update bot configuration interface
4. Add any required service methods

### Debugging Bot Issues
1. Check logs in BotManager (emitted as 'log' events)
2. Verify API token is valid
3. Check character exists and matches exact name
4. Monitor Socket.IO 'log' events for detailed activity

### Testing API Changes
The `apiClient` provides detailed logging. To test new endpoints:
1. Add method to `apiClient.ts`
2. Include proper error handling
3. Update cooldown management if needed
4. Add corresponding types to `types/index.ts`

## Performance Considerations

### Rate Limiting
- Respect API rate limits (cooldowns enforced by API)
- Bots automatically wait for cooldowns
- No parallel actions per character

### Memory Management
- Logs limited to 1000 entries
- Services cache data once at startup
- Bot status uses deep copying for Maps

### Error Recovery
- Bots continue running after errors
- 5-second delay after errors before retry
- Character existence verified on each action