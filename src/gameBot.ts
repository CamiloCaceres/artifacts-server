// server/gameBot.ts
import { EventEmitter } from 'events';
import { BotConfig, BotStatus, Character, Position, Item } from './types';
import { APIClient } from './apiClient';

export class GameBot extends EventEmitter {
  private config: BotConfig;
  private api: APIClient;
  private isRunning: boolean = false;
  private currentCooldown: string | null = null;
  private status: BotStatus = {
    isRunning: false,
    lastAction: '',
    totalActions: 0,
    totalXp: 0,
    totalGold: 0,
    itemsCollected: new Map(),
    currentHp: 0,
    maxHp: 0
  };

  private static readonly RESOURCE_POSITIONS: Record<string, Position> = {
    copper: { x: 2, y: 0 },
    ash_tree: { x: -1, y: 0 },
    sunflower: { x: 2, y: 2 },
    gudgeon: { x: 4, y: 2 },
    iron: { x: 1, y: 7 },
    spruce_tree: { x: 2, y: 6 },
    shrimp: { x: 5, y: 2 }
  };

  constructor(config: BotConfig) {
    super();
    this.config = config;
    this.api = new APIClient(config.apiToken);
  }

  private log(message: string) {
    this.emit('log', message);
  }

  private updateStatus(updates: Partial<BotStatus>) {
    this.status = { ...this.status, ...updates };
    this.emit('statusUpdate', this.status);
  }

  private async handleCooldown() {
    if (!this.currentCooldown) return;
    
    const waitTime = new Date(this.currentCooldown).getTime() - Date.now();
    if (waitTime > 0) {
      this.log(`Waiting for cooldown: ${(waitTime / 1000).toFixed(1)}s`);
      await new Promise(resolve => setTimeout(resolve, waitTime + 500));
    }
    this.currentCooldown = null;
  }

  private async processFightResults(data: any) {
    if (!data.fight) return;
    
    this.updateStatus({
      totalActions: this.status.totalActions + 1,
      totalXp: this.status.totalXp + data.fight.xp,
      totalGold: this.status.totalGold + data.fight.gold
    });

    if (data.fight.drops) {
      const itemsCollected = new Map(this.status.itemsCollected);
      data.fight.drops.forEach((drop: Item) => {
        const current = itemsCollected.get(drop.code) || 0;
        itemsCollected.set(drop.code, current + drop.quantity);
      });
      this.updateStatus({ itemsCollected });
    }
  }

  private async processGatherResults(data: any) {
    if (!data.details) return;

    this.updateStatus({
      totalActions: this.status.totalActions + 1,
      totalXp: this.status.totalXp + data.details.xp
    });

    if (data.details.items) {
      const itemsCollected = new Map(this.status.itemsCollected);
      data.details.items.forEach((item: Item) => {
        const current = itemsCollected.get(item.code) || 0;
        itemsCollected.set(item.code, current + item.quantity);
      });
      this.updateStatus({ itemsCollected });
    }
  }

  private async depositItems(character: Character): Promise<boolean> {
    try {
      // Move to bank
      await this.api.move(this.config.characterName, { x: 4, y: 1 });
      await this.handleCooldown();

      const items = character.inventory
        .filter(slot => slot.code && slot.quantity > 0)
        .map(slot => ({
          code: slot.code!,
          quantity: slot.quantity
        }));

      for (const item of items) {
        const result:any = await this.api.deposit(this.config.characterName, item);
        this.log(`Deposited ${item.quantity}x ${item.code}`);
        
        if (result.data.cooldown?.expiration) {
          this.currentCooldown = result.data.cooldown.expiration;
          await this.handleCooldown();
        }
        
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      return true;
    } catch (error) {
      this.log(`Error depositing items: ${error}`);
      return false;
    }
  }

  private async runBot() {
    while (this.isRunning) {
      try {
        await this.handleCooldown();

        const characters = await this.api.getCharacters();
        const character = characters.data.find(c => c.name === this.config.characterName);
        
        if (!character) {
          this.log('Character not found');
          await new Promise(resolve => setTimeout(resolve, 5000));
          continue;
        }

        this.updateStatus({
          currentHp: character.hp,
          maxHp: character.max_hp
        });

        // Check if rest is needed
        const hpPercent = (character.hp / character.max_hp) * 100;
        if ((this.config.actionType === 'fight' && hpPercent < 50) || 
            (this.config.actionType === 'gather' && hpPercent < 30)) {
          this.log('HP low, resting...');
          const restResult:any = await this.api.rest(this.config.characterName);
          if (restResult.data.cooldown?.expiration) {
            this.currentCooldown = restResult.data.cooldown.expiration;
          }
          continue;
        }

        // Check inventory
        const inventoryTotal = character.inventory
          .reduce((total, slot) => total + slot.quantity, 0);
        
        if (inventoryTotal >= 100) {
          this.log('Inventory full, depositing items...');
          await this.depositItems(character);
          continue;
        }

        // Move to resource if needed
        if (this.config.resource) {
          const targetPos = GameBot.RESOURCE_POSITIONS[this.config.resource];
          if (targetPos && (character.x !== targetPos.x || character.y !== targetPos.y)) {
            const moveResult:any = await this.api.move(this.config.characterName, targetPos);
            if (moveResult.data.cooldown?.expiration) {
              this.currentCooldown = moveResult.data.cooldown.expiration;
            }
            continue;
          }
        }

        // Perform main action
        const actionResult:any = this.config.actionType === 'fight'
          ? await this.api.fight(this.config.characterName)
          : await this.api.gather(this.config.characterName);

        if (actionResult.data.cooldown?.expiration) {
          this.currentCooldown = actionResult.data.cooldown.expiration;
        }

        if (this.config.actionType === 'fight') {
          await this.processFightResults(actionResult.data);
        } else {
          await this.processGatherResults(actionResult.data);
        }

      } catch (error) {
        this.log(`Error: ${error}`);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
  }

  public start() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.updateStatus({ isRunning: true });
    this.log('Bot started');
    this.runBot().catch(error => {
      this.log(`Fatal error: ${error}`);
      this.stop();
    });
  }

  public stop() {
    this.isRunning = false;
    this.updateStatus({ isRunning: false });
    this.log('Bot stopped');
  }

  public getStatus(): BotStatus {
    return this.status;
  }
}
