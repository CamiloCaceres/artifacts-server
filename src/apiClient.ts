import { Account, Character, Position, Item } from "./types";

export class APIClient {
  private baseUrl: string;
  private headers: HeadersInit;
  private apiToken: string;
  private cachedAccountName: string | null = null;

  constructor(
    apiToken: string,
    baseUrl: string = "https://api.artifactsmmo.com"
  ) {
    this.baseUrl = baseUrl;
    this.apiToken = apiToken;
    this.headers = {
      Authorization: `Bearer ${apiToken}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    };
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        ...this.headers,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      let error;
      try {
        error = JSON.parse(errorText);
      } catch {
        error = { message: errorText || "An error occurred" };
      }
      console.error(`API Error ${response.status} for ${endpoint}:`, error);
      throw new Error(
        error.message || `HTTP error! status: ${response.status}`
      );
    }

    return response.json();
  }

  private decodeJWTAccountName(): string | null {
    try {
      if (!this.apiToken) {
        return null;
      }
      
      const payload = this.apiToken.split('.')[1];
      if (!payload) return null;
      
      const decoded = JSON.parse(Buffer.from(payload, 'base64').toString());
      return decoded.account || decoded.username || decoded.sub || null;
    } catch (error) {
      return null;
    }
  }

  async getAccountDetails() {
    return this.request<{ data: Account }>("/my/details");
  }

  private async getAccountName(): Promise<string> {
    if (this.cachedAccountName) {
      return this.cachedAccountName;
    }

    // First try to extract from JWT token
    const jwtAccountName = this.decodeJWTAccountName();
    if (jwtAccountName) {
      this.cachedAccountName = jwtAccountName;
      return this.cachedAccountName;
    }

    // Use the correct API endpoint to get account details
    try {
      const accountDetails = await this.getAccountDetails();
      this.cachedAccountName = accountDetails.data.username;
      return this.cachedAccountName;
    } catch (error) {
      throw new Error(`Failed to get account name: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getCharacters() {
    // Try the new endpoint first, fall back to old one if needed
    try {
      const accountName = await this.getAccountName();
      console.log(`Using account name '${accountName}' for new characters endpoint`);
      return this.request<{ data: Character[] }>(`/accounts/${accountName}/characters`);
    } catch (error) {
      console.warn("Failed to get account info, falling back to deprecated /my/characters endpoint:", error);
      return this.request<{ data: Character[] }>("/my/characters");
    }
  }

  async move(characterName: string, position: Position) {
    console.log(`Moving character ${characterName} to position:`, position);
    const encodedName = encodeURIComponent(characterName);
    return this.request(`/my/${encodedName}/action/move`, {
      method: "POST",
      body: JSON.stringify(position),
    });
  }

  async gather(characterName: string) {
    const encodedName = encodeURIComponent(characterName);
    return this.request(`/my/${encodedName}/action/gathering`, {
      method: "POST",
    });
  }

  async fight(characterName: string) {
    const encodedName = encodeURIComponent(characterName);
    return this.request(`/my/${encodedName}/action/fight`, {
      method: "POST",
    });
  }

  async rest(characterName: string) {
    const encodedName = encodeURIComponent(characterName);
    return this.request(`/my/${encodedName}/action/rest`, {
      method: "POST",
    });
  }

  async deposit(characterName: string, item: Item) {
    const encodedName = encodeURIComponent(characterName);
    return this.request(`/my/${encodedName}/action/bank/deposit`, {
      method: "POST",
      body: JSON.stringify(item),
    });
  }

  async withdraw(characterName: string, item: Item) {
    const encodedName = encodeURIComponent(characterName);
    return this.request(`/my/${encodedName}/action/bank/withdraw`, {
      method: "POST",
      body: JSON.stringify(item),
    });
  }

  async craft(characterName: string, item: Item) {
    const encodedName = encodeURIComponent(characterName);
    console.log(`Crafting request for ${characterName}:`, item);
    return this.request(`/my/${encodedName}/action/crafting`, {
      method: "POST",
      body: JSON.stringify(item),
    });
  }

  async depositAll(characterName: string, items: Item[]) {
    for (const item of items) {
      await this.deposit(characterName, item);
      // Add small delay between deposits to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 3500));
    }
  }

  async withdrawAll(characterName: string, items: Item[]) {
    for (const item of items) {
      await this.withdraw(characterName, item);
      // Add small delay between withdrawals to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 3500));
    }
  }
}
