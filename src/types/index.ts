export interface Character {
  name: string;
  hp: number;
  max_hp: number;
  x: number;
  y: number;
  inventory: InventorySlot[];
}

export interface InventorySlot {
  code: string | null;
  quantity: number;
}

export interface Item {
  code: string;
  quantity: number;
}

export interface Position {
  x: number;
  y: number;
}

export interface BotConfig {
  apiToken: string;
  characterName: string;
  actionType: "fight" | "gather" | "craft";
  resource?: string;
  baseUrl?: string;
  craftingCycle?: CraftingCycle;
}

export interface BotStatus {
  isRunning: boolean;
  lastAction: string;
  totalActions: number;
  totalXp: number;
  totalGold: number;
  itemsCollected: Map<string, number>;
  currentHp?: number;
  maxHp?: number;
  lastError?: string;
  craftingStats?: CraftingStats;
}

export interface CraftingStep {
  type: "withdraw" | "deposit" | "craft" | "move";
  item?: string;
  quantity?: number;
  location?: "bank" | "woodcutting" | "mining";
  position?: Position;
  materialsUsed?: Map<string, number>;
  itemsCrafted?: Map<string, number>;
}

export interface CraftingCycle {
  id: string;
  name: string;
  description?: string;
  steps: CraftingStep[];
  requiredItems?: Item[];
  expectedOutput?: Item[];
}

export interface CraftingStats {
  itemsCrafted: Map<string, number>;
  totalCrafts: number;
  failedCrafts: number;
  currentCycle: string | null;
  cycleProgress: number;
  materialsUsed: Map<string, number>;
}

// Resource positions type safety
export type ResourceType =
  | "copper"
  | "ash_tree"
  | "sunflower"
  | "gudgeon"
  | "iron"
  | "spruce_tree"
  | "shrimp"
  | "coal"
  | "birch";
