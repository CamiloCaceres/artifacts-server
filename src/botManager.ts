// server/botManager.ts
import { EventEmitter } from 'events';
import { BotConfig, BotStatus } from './types';
import { GameBot } from './gameBot';

interface LogEntry {
    characterName: string;
    message: string;
    timestamp: string;
}

export class GameBotManager extends EventEmitter {
  private bots: Map<string, GameBot> = new Map();
  private botsStatus: Map<string, BotStatus> = new Map();
  private botsConfig: Map<string, BotConfig> = new Map();
  private apiToken: string;
  private logs: LogEntry[] = [];
  private readonly MAX_LOGS = 1000; // Keep last 1000 logs in memory

  constructor(apiToken: string) {
    super();
    this.apiToken = apiToken;
    this.initializeBots();
  }

  private initializeBots() {
    const defaultConfigs: BotConfig[] = [
      { characterName: "Psy", actionType: "fight", apiToken: this.apiToken },
      { characterName: "Atlas", actionType: "gather", resource: "iron", apiToken: this.apiToken },
      { characterName: "Shiva", actionType: "gather", resource: "copper", apiToken: this.apiToken },
      { characterName: "Yoga", actionType: "gather", resource: "ash_tree", apiToken: this.apiToken },
      { characterName: "Shakti", actionType: "gather", resource: "spruce_tree", apiToken: this.apiToken }
    ];

    defaultConfigs.forEach(config => {
      this.createBot(config);
    });
  }

  private createBot(config: BotConfig) {
    const bot = new GameBot(config);
    
    bot.on('statusUpdate', (status: BotStatus) => {
      this.botsStatus.set(config.characterName, status);
      this.emit('statusUpdate', {
        characterName: config.characterName,
        status
      });
    });

    bot.on('log', (message: string) => {
      const logEntry = {
        characterName: config.characterName,
        message,
        timestamp: new Date().toISOString()
      };
      
      this.addLog(logEntry);
      this.emit('log', logEntry);
    });

    this.bots.set(config.characterName, bot);
    this.botsConfig.set(config.characterName, config);
    this.botsStatus.set(config.characterName, bot.getStatus());
  }

  private addLog(log: LogEntry) {
    this.logs.unshift(log);
    if (this.logs.length > this.MAX_LOGS) {
      this.logs = this.logs.slice(0, this.MAX_LOGS);
    }
  }

  public updateBotConfig(characterName: string, newConfig: Partial<BotConfig>) {
    const currentConfig = this.botsConfig.get(characterName);
    if (!currentConfig) return;

    // Stop the bot if it's running
    const bot = this.bots.get(characterName);
    const wasRunning = bot?.getStatus().isRunning;
    if (wasRunning) {
      this.stopBot(characterName);
    }

    // Update config
    const updatedConfig = {
      ...currentConfig,
      ...newConfig,
      apiToken: this.apiToken // Ensure API token remains unchanged
    };

    // Remove old bot instance
    this.bots.delete(characterName);

    // Create new bot with updated config
    this.createBot(updatedConfig);
    this.botsConfig.set(characterName, updatedConfig);

    // Restart bot if it was running
    if (wasRunning) {
      this.startBot(characterName);
    }

    this.emit('configUpdate', {
      characterName,
      config: updatedConfig
    });
  }

  public getBotConfig(characterName: string): BotConfig | undefined {
    return this.botsConfig.get(characterName);
  }

  public getAllConfigs(): Record<string, BotConfig> {
    const configs: Record<string, BotConfig> = {};
    this.botsConfig.forEach((config, characterName) => {
      configs[characterName] = config;
    });
    return configs;
  }

  public getRecentLogs(count: number = 50): LogEntry[] {
    return this.logs.slice(0, count);
  }

  public getAllLogs(): LogEntry[] {
    return [...this.logs];
  }

  public clearLogs() {
    this.logs = [];
  }

  public startBot(characterName: string) {
    const bot = this.bots.get(characterName);
    if (bot) {
      bot.start();
      this.addLog({
        characterName,
        message: 'Bot started',
        timestamp: new Date().toISOString()
      });
    }
  }

  public stopBot(characterName: string) {
    const bot = this.bots.get(characterName);
    if (bot) {
      bot.stop();
      this.addLog({
        characterName,
        message: 'Bot stopped',
        timestamp: new Date().toISOString()
      });
    }
  }

  public startAllBots() {
    this.bots.forEach((bot, characterName) => {
      bot.start();
      this.addLog({
        characterName,
        message: 'Bot started (mass start)',
        timestamp: new Date().toISOString()
      });
    });
  }

  public stopAllBots() {
    this.bots.forEach((bot, characterName) => {
      bot.stop();
      this.addLog({
        characterName,
        message: 'Bot stopped (mass stop)',
        timestamp: new Date().toISOString()
      });
    });
  }

  public getBotStatus(characterName: string): BotStatus | undefined {
    return this.botsStatus.get(characterName);
  }

  public getBotsStatus(): Record<string, BotStatus> {
    const status: Record<string, BotStatus> = {};
    this.botsStatus.forEach((botStatus, characterName) => {
      status[characterName] = botStatus;
    });
    return status;
  }

  public getRunningBots(): string[] {
    return Array.from(this.botsStatus.entries())
      .filter(([_, status]) => status.isRunning)
      .map(([characterName]) => characterName);
  }

  public getBotCount(): number {
    return this.bots.size;
  }

  public getRunningBotCount(): number {
    return this.getRunningBots().length;
  }
}