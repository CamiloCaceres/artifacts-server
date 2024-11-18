import { Character, Position, Item } from './types';
export class APIClient {
    private baseUrl: string;
    private headers: HeadersInit;
  
    constructor(apiToken: string, baseUrl: string = 'https://api.artifactsmmo.com') {
      this.baseUrl = baseUrl;
      this.headers = {
        'Authorization': `Bearer ${apiToken}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      };
    }
  
    private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
      const url = `${this.baseUrl}${endpoint}`;
      const response = await fetch(url, {
        ...options,
        headers: {
          ...this.headers,
          ...options.headers
        }
      });
  
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'An error occurred' }));
        throw new Error(error.message || `HTTP error! status: ${response.status}`);
      }
  
      return response.json();
    }
  
    async getCharacters() {
      return this.request<{ data: Character[] }>('/my/characters');
    }
  
    async move(characterName: string, position: Position) {
      return this.request(`/my/${characterName}/action/move`, {
        method: 'POST',
        body: JSON.stringify(position)
      });
    }
  
    async gather(characterName: string) {
      return this.request(`/my/${characterName}/action/gathering`, {
        method: 'POST'
      });
    }
  
    async fight(characterName: string) {
      return this.request(`/my/${characterName}/action/fight`, {
        method: 'POST'
      });
    }
  
    async rest(characterName: string) {
      return this.request(`/my/${characterName}/action/rest`, {
        method: 'POST'
      });
    }
  
    async deposit(characterName: string, item: Item) {
      return this.request(`/my/${characterName}/action/bank/deposit`, {
        method: 'POST',
        body: JSON.stringify(item)
      });
    }
  }