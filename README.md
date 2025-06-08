# ArtifactsMMO Game Bot Backend

A powerful backend server for automating game bots in [ArtifactsMMO](https://artifactsmmo.com/), a sandbox MMORPG with full API support. This project provides real-time bot management through a WebSocket interface, enabling automated fighting, resource gathering, and crafting operations.

## 🎮 About ArtifactsMMO

ArtifactsMMO is a unique sandbox MMORPG where every game action is accessible through an HTTP API. The game features:
- 40 levels of combat and skills progression
- 8 different skills: Mining, Woodcutting, Cooking, Alchemy, Gearcrafting, Weaponcrafting, Jewelrycrafting
- Elemental combat system (fire, air, water, earth)
- Player trading through the Grand Exchange
- Full API documentation for building custom tools and bots

## ✨ Features

- **Multi-Character Support**: Manage multiple game characters simultaneously
- **Real-time Control**: WebSocket-based communication for instant bot control and status updates
- **Three Bot Modes**:
  - **Fighting**: Automated monster hunting with XP and loot collection
  - **Gathering**: Resource collection from nodes (mining, woodcutting, etc.)
  - **Crafting**: Complex multi-step crafting cycles with bank management
- **Smart Automation**:
  - Auto-banking when inventory is full
  - HP management with automatic resting
  - Cooldown handling between actions
  - Dynamic pathfinding to targets
- **Comprehensive Logging**: Track all bot activities, statistics, and errors
- **Hot Configuration**: Update bot settings without restarting

## 📋 Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- ArtifactsMMO account and API token

## 🚀 Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/artifacts-server.git
cd artifacts-server
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory:
```env
API_TOKEN=your_artifactsmmo_api_token_here
PORT=3001  # Optional, defaults to 3001
```

4. Build the TypeScript code:
```bash
npm run build
```

## 🏃 Running the Server

### Development Mode (with auto-reload):
```bash
npm run dev
```

### Production Mode:
```bash
npm start
```

### Docker Deployment:

#### Using Docker:
```bash
# Build the image
docker build -t artifacts-bot-server .

# Run the container
docker run -d \
  --name artifacts-bot \
  -p 3001:3001 \
  -e API_TOKEN=your_artifactsmmo_api_token_here \
  artifacts-bot-server
```

#### Using Docker Compose:
```bash
# Create .env file with your API_TOKEN
echo "API_TOKEN=your_artifactsmmo_api_token_here" > .env

# Start the service
docker-compose up -d

# View logs
docker-compose logs -f

# Stop the service
docker-compose down
```

The server will start on `http://localhost:3001` (or your configured PORT).

## 🔧 Configuration

### Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `API_TOKEN` | Your ArtifactsMMO API authentication token | Yes | - |
| `PORT` | Server port number | No | 3001 |

### Bot Configuration Structure

Each bot can be configured with the following options:

```typescript
{
  apiToken: string;              // API token for authentication
  characterName: string;         // Character name in the game
  actionType: "fight" | "gather" | "craft";  // Bot mode
  
  // For fighting bots:
  selectedMonster?: string;      // Monster code (e.g., "chicken", "wolf")
  monsterSkin?: string;          // Specific monster appearance
  
  // For gathering bots:
  resource?: string;             // Resource code (e.g., "iron", "copper_ore")
  resourceSkin?: string;         // Specific resource appearance
  
  // For crafting bots:
  craftingCycle?: {
    id: string;
    name: string;
    steps: Array<{
      action: "withdraw" | "move" | "craft" | "deposit";
      location?: { x: number; y: number };
      item?: string;
      quantity?: number;
    }>;
  };
}
```

## 🔌 WebSocket API

The server exposes a Socket.IO interface for real-time communication:

### Events (Client → Server)

| Event | Payload | Description |
|-------|---------|-------------|
| `startBot` | `{ characterName: string }` | Start a specific bot |
| `stopBot` | `{ characterName: string }` | Stop a specific bot |
| `startAllBots` | - | Start all configured bots |
| `stopAllBots` | - | Stop all running bots |
| `updateBotConfig` | Bot configuration object | Update bot settings |
| `requestStatus` | - | Request current status of all bots |
| `requestLogs` | - | Request activity logs |

### Events (Server → Client)

| Event | Payload | Description |
|-------|---------|-------------|
| `statusUpdate` | Status object | Bot status updates |
| `log` | Log entry | Activity log entries |
| `configUpdate` | Configuration object | Configuration changes |

## 📝 API Endpoints Used

This bot interacts with the following ArtifactsMMO API endpoints:

- `GET /my/characters` - Retrieve character information
- `POST /my/{character}/action/move` - Move character to coordinates
- `POST /my/{character}/action/gathering` - Gather resources
- `POST /my/{character}/action/fight` - Fight monsters
- `POST /my/{character}/action/rest` - Rest to recover HP
- `POST /my/{character}/action/bank/deposit` - Deposit items
- `POST /my/{character}/action/bank/withdraw` - Withdraw items
- `POST /my/{character}/action/crafting` - Craft items
- `GET /maps?content_type=monster` - Get monster spawn locations
- `GET /maps?content_type=resource` - Get resource node locations

## 🤖 Default Bots

The server initializes with 5 pre-configured bots:

1. **Psy** - Gathering bot (copper ore mining)
2. **Atlas** - Fighting bot (targeting chickens)
3. **Shiva** - Gathering bot (tree cutting)
4. **Yoga** - Gathering bot (iron mining)
5. **Shakti** - Crafting bot (copper ingot production)

## 📊 Bot Behaviors

### Fighting Bots
- Move to monster location
- Fight until inventory is full or HP is low
- Rest when HP falls below 50%
- Auto-deposit loot when inventory is full
- Track kills, XP gained, and gold earned

### Gathering Bots
- Move to resource nodes
- Gather resources continuously
- Rest when HP falls below 30%
- Auto-deposit when inventory is full
- Track resources gathered

### Crafting Bots
- Execute multi-step crafting cycles
- Withdraw materials from bank
- Move between crafting stations
- Craft specified quantities
- Deposit finished products
- Track materials used and items produced

## 🛡️ Error Handling

The bot system includes robust error handling:
- Automatic retry on API failures
- Graceful cooldown management
- Character not found detection
- Inventory full handling
- Invalid action prevention

## 📈 Monitoring

The bot manager maintains detailed logs including:
- Action timestamps
- Character activities
- Resource/item collection
- Errors and warnings
- Statistics (XP, gold, items)

Logs are limited to the most recent 1000 entries to prevent memory issues.

## 🔗 Related Links

- [ArtifactsMMO Official Website](https://artifactsmmo.com/)
- [ArtifactsMMO API Documentation](https://api.artifactsmmo.com/docs)
- [ArtifactsMMO Game Documentation](https://docs.artifactsmmo.com/)

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## ⚠️ Disclaimer

This bot is for educational and personal use. Please ensure you comply with ArtifactsMMO's terms of service and API usage guidelines. The game developers explicitly support API usage for automation, but be respectful of rate limits and server resources.