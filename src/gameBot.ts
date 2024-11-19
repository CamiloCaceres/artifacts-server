import { EventEmitter } from "events";
import {
  BotConfig,
  BotStatus,
  Character,
  Position,
  Item,
  CraftingStep,
  CraftingStats,
} from "./types";
import { APIClient } from "./apiClient";
import { MonsterService } from "./services/monsterService";

export class GameBot extends EventEmitter {
  private config: BotConfig;
  private api: APIClient;
  private isRunning: boolean = false;
  private currentCooldown: string | null = null;
  private status: BotStatus = {
    isRunning: false,
    lastAction: "",
    totalActions: 0,
    totalXp: 0,
    totalGold: 0,
    itemsCollected: new Map(),
    currentHp: 0,
    maxHp: 0,
    craftingStats: {
      itemsCrafted: new Map(),
      totalCrafts: 0,
      failedCrafts: 0,
      currentCycle: null,
      cycleProgress: 0,
      materialsUsed: new Map(),
    },
  };

  private static readonly RESOURCE_POSITIONS: Record<string, Position> = {
    copper: { x: 2, y: 0 },
    ash_tree: { x: -1, y: 0 },
    sunflower: { x: 2, y: 2 },
    gudgeon: { x: 4, y: 2 },
    iron: { x: 1, y: 7 },
    spruce_tree: { x: 2, y: 6 },
    shrimp: { x: 5, y: 2 },
    birch_tree: { x: 3, y: 5 },
    coal: { x: 1, y: 6 },
  };

  private static readonly CRAFTING_LOCATIONS: Record<string, Position> = {
    bank: { x: 4, y: 1 },
    woodcutting: { x: -2, y: -3 },
    mining: { x: 1, y: 5 },
    jewelry: { x: 1, y: 3 },
    gearcrafting: { x: 3, y: 1 },
    weaponcrafting: { x: 2, y: 1 },
    cooking: { x: 1, y: 1 },
    alchemy: { x: 2, y: 3 },
  };

  private monsterService: MonsterService;

  constructor(config: BotConfig) {
    super();
    this.config = config;
    this.api = new APIClient(config.apiToken);
    this.monsterService = MonsterService.getInstance();
  }

  private log(message: string) {
    this.emit("log", message);
  }

  private updateStatus(updates: Partial<BotStatus>) {
    this.status = { ...this.status, ...updates };
    this.emit("statusUpdate", this.status);
  }

  private updateCraftingStats(updates: Partial<CraftingStats>) {
    const currentStats = this.status.craftingStats || {
      itemsCrafted: new Map(),
      totalCrafts: 0,
      failedCrafts: 0,
      currentCycle: null,
      cycleProgress: 0,
      materialsUsed: new Map(),
    };

    this.status.craftingStats = {
      ...currentStats,
      ...updates,
      itemsCrafted: new Map([
        ...currentStats.itemsCrafted,
        ...(updates.itemsCrafted || new Map()),
      ]),
      materialsUsed: new Map([
        ...currentStats.materialsUsed,
        ...(updates.materialsUsed || new Map()),
      ]),
    };

    this.emit("statusUpdate", this.status);
  }

  private async handleCooldown() {
    if (!this.currentCooldown) return;

    const waitTime = new Date(this.currentCooldown).getTime() - Date.now();
    if (waitTime > 0) {
      this.log(`Waiting for cooldown: ${(waitTime / 1000).toFixed(1)}s`);
      await new Promise((resolve) => setTimeout(resolve, waitTime + 500));
    }
    this.currentCooldown = null;
  }

  private async processFightResults(data: any) {
    if (!data.fight) return;

    const xpGained = data.fight.xp;
    const goldGained = data.fight.gold;
    let dropSummary = "";

    if (data.fight.drops) {
      const itemsCollected = new Map(this.status.itemsCollected);
      dropSummary = data.fight.drops
        .map((drop: Item) => {
          const current = itemsCollected.get(drop.code) || 0;
          itemsCollected.set(drop.code, current + drop.quantity);
          return `${drop.quantity}x ${drop.code}`;
        })
        .join(", ");
    }

    this.updateStatus({
      totalActions: this.status.totalActions + 1,
      totalXp: this.status.totalXp + xpGained,
      totalGold: this.status.totalGold + goldGained,
      itemsCollected: new Map(this.status.itemsCollected),
    });

    this.log(
      `Fight completed: +${xpGained} XP, +${goldGained} gold${
        dropSummary ? `, Drops: ${dropSummary}` : ""
      }`
    );
  }
  private async processGatherResults(data: any) {
    if (!data.details) return;

    const xpGained = data.details.xp;
    let itemSummary = "";

    if (data.details.items) {
      const itemsCollected = new Map(this.status.itemsCollected);
      itemSummary = data.details.items
        .map((item: Item) => {
          const current = itemsCollected.get(item.code) || 0;
          itemsCollected.set(item.code, current + item.quantity);
          return `${item.quantity}x ${item.code}`;
        })
        .join(", ");
    }

    this.updateStatus({
      totalActions: this.status.totalActions + 1,
      totalXp: this.status.totalXp + xpGained,
      itemsCollected: new Map(this.status.itemsCollected),
    });

    this.log(`Gathered: ${itemSummary}${xpGained ? `, +${xpGained} XP` : ""}`);
  }

  private async executeCraftingStep(
    step: CraftingStep,
    character: Character
  ): Promise<boolean> {
    try {
      switch (step.type) {
        case "withdraw":
          if (!step.item || !step.quantity) return false;
          await this.moveToBank(character);
          const withdrawResult: any = await this.api.withdraw(
            this.config.characterName,
            {
              code: step.item,
              quantity: step.quantity,
            }
          );

          if (withdrawResult.data?.cooldown?.expiration) {
            this.currentCooldown = withdrawResult.data.cooldown.expiration;
          }

          const currentUsed =
            this.status.craftingStats?.materialsUsed.get(step.item) || 0;
          this.updateCraftingStats({
            materialsUsed: new Map([[step.item, currentUsed + step.quantity]]),
          });
          this.log(`Withdrawn ${step.quantity}x ${step.item}`);
          break;

        case "deposit":
          if (!step.item || !step.quantity) return false;
          await this.moveToBank(character);
          const depositResult: any = await this.api.deposit(
            this.config.characterName,
            {
              code: step.item,
              quantity: step.quantity,
            }
          );

          if (depositResult.data?.cooldown?.expiration) {
            this.currentCooldown = depositResult.data.cooldown.expiration;
          }

          const currentCrafted =
            this.status.craftingStats?.itemsCrafted.get(step.item) || 0;
          this.updateCraftingStats({
            itemsCrafted: new Map([
              [step.item, currentCrafted + step.quantity],
            ]),
          });
          this.log(`Deposited ${step.quantity}x ${step.item}`);
          break;

        case "craft":
          if (!step.item || !step.quantity) return false;
          const craftResult: any = await this.api.craft(
            this.config.characterName,
            {
              code: step.item,
              quantity: step.quantity,
            }
          );

          if (craftResult.data?.cooldown?.expiration) {
            this.currentCooldown = craftResult.data.cooldown.expiration;
          }

          this.updateCraftingStats({
            totalCrafts: (this.status.craftingStats?.totalCrafts || 0) + 1,
          });
          this.log(`Crafted ${step.quantity}x ${step.item}`);
          break;

        case "move":
          if (step.location) {
            const position = GameBot.CRAFTING_LOCATIONS[step.location];
            if (!position) return false;
            await this.move(position, character);
          } else if (step.position) {
            await this.move(step.position, character);
          }
          break;

        default:
          this.log(`Unknown crafting step type: ${(step as any).type}`);
          return false;
      }

      await this.handleCooldown();
      return true;
    } catch (error) {
      this.log(`Crafting step failed: ${error}`);
      this.updateCraftingStats({
        failedCrafts: (this.status.craftingStats?.failedCrafts || 0) + 1,
      });
      return false;
    }
  }

  private async executeCraftingCycle() {
    if (!this.config.craftingCycle) {
      throw new Error("No crafting cycle configured");
    }

    const { steps } = this.config.craftingCycle;
    let currentStep = 0;
    const totalSteps = steps.length;

    while (currentStep < totalSteps && this.isRunning) {
      const character = await this.api
        .getCharacters()
        .then((res) =>
          res.data.find((c) => c.name === this.config.characterName)
        );

      if (!character) {
        throw new Error("Failed to get character info");
      }

      // Check inventory space
      const inventoryTotal = character.inventory.reduce(
        (total, slot) => total + slot.quantity,
        0
      );

      if (inventoryTotal >= 100) {
        await this.moveToBank(character);
        await this.depositItems(character);
        continue;
      }

      const success = await this.executeCraftingStep(
        steps[currentStep],
        character
      );
      if (success) {
        currentStep++;
        this.updateCraftingStats({
          cycleProgress: Math.floor((currentStep / totalSteps) * 100),
        });
      } else {
        await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait before retry
      }
    }

    if (currentStep >= totalSteps) {
      this.updateCraftingStats({
        cycleProgress: 0,
      });
    }
  }

  private async move(targetPos: Position, character: Character): Promise<void> {
    if (character.x === targetPos.x && character.y === targetPos.y) return;

    const result: any = await this.api.move(
      this.config.characterName,
      targetPos
    );
    if (result.data?.cooldown?.expiration) {
      this.currentCooldown = result.data.cooldown.expiration;
      await this.handleCooldown();
    }
  }

  private async moveToBank(character: Character): Promise<void> {
    await this.move(GameBot.CRAFTING_LOCATIONS.bank, character);
  }

  private async depositItems(character: Character): Promise<void> {
    const items = character.inventory
      .filter((slot) => slot.code && slot.quantity > 0)
      .map((slot) => ({
        code: slot.code!,
        quantity: slot.quantity,
      }));

    await this.api.depositAll(this.config.characterName, items);
  }

  private async moveToResource(character: Character): Promise<void> {
    if (!this.config.resource) return;

    const targetPos = GameBot.RESOURCE_POSITIONS[this.config.resource];
    if (!targetPos) {
      throw new Error(`Invalid resource type: ${this.config.resource}`);
    }

    await this.move(targetPos, character);
  }

  private async rest(character: Character): Promise<void> {
    const hpPercent = (character.hp / character.max_hp) * 100;
    const needsRest =
      (this.config.actionType === "fight" && hpPercent < 50) ||
      (this.config.actionType === "gather" && hpPercent < 30);

    if (needsRest) {
      this.log(`HP low (${hpPercent.toFixed(1)}%), resting...`);
      const result: any = await this.api.rest(this.config.characterName);

      if (result.data?.cooldown?.expiration) {
        this.currentCooldown = result.data.cooldown.expiration;
        await this.handleCooldown();
      }
    }
  }

  private async performMainAction(): Promise<void> {
    if (this.config.actionType === "fight" && this.config.fightLocation) {
      const characters = await this.api.getCharacters();
      const character = characters.data.find(
        (c) => c.name === this.config.characterName
      );

      if (character && this.config.selectedMonster) {
        const monsterLocation = this.monsterService.getMonsterPosition(
          this.config.selectedMonster,
          this.config.monsterSkin
        );

        if (monsterLocation) {
          await this.move(monsterLocation.position, character);
        } else {
          this.log(
            `Error: Could not find position for monster ${this.config.selectedMonster}`
          );
          return;
        }
      }
    }

    const result: any =
      this.config.actionType === "fight"
        ? await this.api.fight(this.config.characterName)
        : await this.api.gather(this.config.characterName);

    if (result.data?.cooldown?.expiration) {
      this.currentCooldown = result.data.cooldown.expiration;
    }

    if (this.config.actionType === "fight") {
      await this.processFightResults(result.data);
    } else {
      await this.processGatherResults(result.data);
    }

    await this.handleCooldown();
  }

  public async start() {
    if (this.isRunning) return;

    this.isRunning = true;
    this.updateStatus({ isRunning: true });
    this.log("Bot started");

    while (this.isRunning) {
      try {
        const characters = await this.api.getCharacters();
        const character = characters.data.find(
          (c) => c.name === this.config.characterName
        );

        if (!character) {
          this.log("Character not found");
          await new Promise((resolve) => setTimeout(resolve, 5000));
          continue;
        }

        this.updateStatus({
          currentHp: character.hp,
          maxHp: character.max_hp,
        });

        await this.rest(character);

        switch (this.config.actionType) {
          case "craft":
            await this.executeCraftingCycle();
            break;

          case "fight":
          case "gather":
            const inventoryTotal = character.inventory.reduce(
              (total, slot) => total + slot.quantity,
              0
            );

            if (inventoryTotal >= 100) {
              this.log("Inventory full, depositing items...");
              await this.moveToBank(character);
              await this.depositItems(character);
              continue;
            }

            if (this.config.actionType === "gather" && this.config.resource) {
              await this.moveToResource(character);
            }

            await this.performMainAction();
            break;
        }
      } catch (error) {
        this.log(`Error: ${error}`);
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }
  }

  public stop() {
    this.isRunning = false;
    this.updateStatus({ isRunning: false });
    this.log("Bot stopped");
  }

  public getStatus(): BotStatus {
    return this.status;
  }
}
