// src/services/monsterService.ts

import { Monster, MonsterLocation } from '../types';

export class MonsterService {
  private static instance: MonsterService;
  private monsterPositions: { [key: string]: MonsterLocation[] } = {};

  private constructor() {}

  public static getInstance(): MonsterService {
    if (!MonsterService.instance) {
      MonsterService.instance = new MonsterService();
    }
    return MonsterService.instance;
  }

  public async initialize() {
    try {
      const response = await fetch('https://api.artifactsmmo.com/maps?content_type=monster', {
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch monster data');
      }

      const data = await response.json();
      this.processMonsterData(data.data);
    } catch (error) {
      console.error('Error initializing monster positions:', error);
      throw error;
    }
  }

  private processMonsterData(monsters: Monster[]) {
    const positions: { [key: string]: MonsterLocation[] } = {};
    
    monsters.forEach(monster => {
      if (!positions[monster.content.code]) {
        positions[monster.content.code] = [];
      }
      
      positions[monster.content.code].push({
        code: monster.content.code,
        skin: monster.skin,
        position: { x: monster.x, y: monster.y }
      });
    });

    this.monsterPositions = positions;
  }

  public getMonsterPosition(monsterCode: string, skin?: string): MonsterLocation | undefined {
    const monsters = this.monsterPositions[monsterCode];
    if (!monsters?.length) return undefined;

    if (skin) {
      return monsters.find(m => m.skin === skin);
    }

    return monsters[0];
  }

  public getAllMonsters(): { code: string, locations: MonsterLocation[] }[] {
    return Object.entries(this.monsterPositions).map(([code, locations]) => ({
      code,
      locations
    }));
  }

  public getMonstersByCode(code: string): MonsterLocation[] {
    return this.monsterPositions[code] || [];
  }
}