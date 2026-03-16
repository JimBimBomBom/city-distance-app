/**
 * CDS Client - Browser & Node.js compatible client for City Distance Service
 * Uses native fetch API (works in all modern browsers and Node.js 18+)
 * No external dependencies.
 */

export interface CDSClientConfig {
  baseURL: string;
  username?: string;
  password?: string;
  timeout?: number;
  retries?: number;
}

export interface Language {
  code: string;
  name: string;
  flag?: string;
  countryCode?: string;
}

export interface CitySuggestion {
  id: string;
  name: string;
  countryCode: string | null;
  country: string | null;
  adminRegion: string | null;
  population: number | null;
  flag: string;
}

export class CDSError extends Error {
  public statusCode?: number;
  public response?: any;
  public clientSide: boolean;

  constructor(message: string, statusCode?: number, response?: any) {
    super(message);
    this.name = 'CDSError';
    this.statusCode = statusCode;
    this.response = response;
    this.clientSide = statusCode !== undefined && statusCode >= 400 && statusCode < 500;
  }
}

export class CDSClient {
  private baseURL: string;
  private authHeader: string | null;
  private timeout: number;
  private retries: number;
  private language: string | null = null;

  constructor(config: CDSClientConfig) {
    this.baseURL = config.baseURL.replace(/\/+$/, '');
    this.timeout = config.timeout || 30000;
    this.retries = config.retries || 2;

    if (config.username && config.password) {
      this.authHeader = 'Basic ' + btoa(config.username + ':' + config.password);
    } else {
      this.authHeader = null;
    }
  }

  /** Set the language code sent via Accept-Language header */
  setLanguage(code: string): void {
    this.language = code;
  }

  /** Get the currently configured language */
  getLanguage(): string | null {
    return this.language;
  }

  private buildHeaders(extra?: Record<string, string>): Record<string, string> {
    const h: Record<string, string> = { Accept: 'application/json' };
    if (this.authHeader) h['Authorization'] = this.authHeader;
    if (this.language) h['Accept-Language'] = this.language;
    if (extra) Object.assign(h, extra);
    return h;
  }

  private async request(url: string, opts?: RequestInit): Promise<Response> {
    let lastError: any;

    for (let attempt = 0; attempt <= this.retries; attempt++) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.timeout);

        const res = await fetch(url, { ...opts, signal: controller.signal });
        clearTimeout(timer);

        if (res.ok) return res;

        let serverMsg = '';
        try {
          const body = await res.clone().json();
          serverMsg = body.error || body.message || '';
        } catch {
          serverMsg = await res.text().catch(() => '');
        }

        const err = new CDSError(
          res.status >= 400 && res.status < 500
            ? `Request error (${res.status})${serverMsg ? ': ' + serverMsg : ''}`
            : `Server error (${res.status}). Please try again later.`,
          res.status,
          serverMsg
        );

        // Don't retry 4xx
        if (res.status >= 400 && res.status < 500) throw err;
        lastError = err;
      } catch (e: any) {
        if (e instanceof CDSError) throw e;
        lastError = new CDSError(
          'Could not reach the server. Check your network connection.',
          undefined,
          e.message
        );
      }
    }
    throw lastError;
  }

  /** Fetch supported languages from the backend */
  async getLanguages(): Promise<Language[]> {
    const res = await this.request(`${this.baseURL}/languages`, {
      headers: this.buildHeaders(),
    });
    const body = await res.json();
    return Array.isArray(body) ? body : (body.data || []);
  }

  /** Get city suggestions for a partial query (min 2 chars) */
  async getSuggestions(query: string): Promise<CitySuggestion[]> {
    if (!query || query.length < 2) return [];
    const res = await this.request(
      `${this.baseURL}/suggestions?q=${encodeURIComponent(query)}`,
      { headers: this.buildHeaders() }
    );
    const body = await res.json();
    return Array.isArray(body) ? body : (body.data || []);
  }

  /** Calculate distance between two cities by their IDs */
  async calculateDistance(city1Id: string, city2Id: string): Promise<number> {
    if (!city1Id || !city2Id) throw new CDSError('Both city IDs are required', 400);
    const res = await this.request(`${this.baseURL}/distance`, {
      method: 'POST',
      headers: this.buildHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ City1: city1Id, City2: city2Id }),
    });
    const data = await res.json();
    return data.Distance ?? data.distanceKm ?? data.distance ?? data;
  }

  /** Health check */
  async healthCheck(): Promise<boolean> {
    try {
      await this.request(`${this.baseURL}/health_check`, { headers: this.buildHeaders() });
      return true;
    } catch {
      return false;
    }
  }
}

export default CDSClient;
export { FlagUtils, FormatUtils } from './utils';
