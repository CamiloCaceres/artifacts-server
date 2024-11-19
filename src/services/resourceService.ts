// src/services/resourceService.ts

import { Position } from '../types';

export interface ResourceLocation {
  code: string;
  skin: string;
  position: Position;
  name: string;
}

export class ResourceService {
  private static instance: ResourceService;
  private resourcePositions: { [key: string]: ResourceLocation[] } = {};

  private constructor() {}

  public static getInstance(): ResourceService {
    if (!ResourceService.instance) {
      ResourceService.instance = new ResourceService();
    }
    return ResourceService.instance;
  }

  public async initialize() {
    try {
      const response = await fetch('https://api.artifactsmmo.com/maps?content_type=resource', {
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch resource data');
      }

      const data = await response.json();
      this.processResourceData(data.data);
    } catch (error) {
      console.error('Error initializing resource positions:', error);
      throw error;
    }
  }

  private processResourceData(resources: any[]) {
    const positions: { [key: string]: ResourceLocation[] } = {};
    
    resources.forEach(resource => {
      const code = resource.content.code;
      if (!positions[code]) {
        positions[code] = [];
      }
      
      positions[code].push({
        code: code,
        skin: resource.skin,
        name: resource.name,
        position: { x: resource.x, y: resource.y }
      });
    });

    this.resourcePositions = positions;
  }

  public getResourcePosition(resourceCode: string, skin?: string): ResourceLocation | undefined {
    const resources = this.resourcePositions[resourceCode];
    if (!resources?.length) return undefined;

    if (skin) {
      return resources.find(r => r.skin === skin);
    }

    return resources[0];
  }

  public getAllResources(): { code: string, locations: ResourceLocation[] }[] {
    return Object.entries(this.resourcePositions).map(([code, locations]) => ({
      code,
      locations
    }));
  }

  public getResourcesByCode(code: string): ResourceLocation[] {
    return this.resourcePositions[code] || [];
  }
}