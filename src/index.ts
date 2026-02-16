import axios, { AxiosInstance, AxiosError } from 'axios';
import axiosRetry from 'axios-retry';

export interface CDSClientConfig {
  baseURL: string;
  username?: string;
  password?: string;
  timeout?: number;
  retries?: number;
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

export interface DistanceRequest {
  city1: string;
  city2: string;
}

export interface DistanceResponse {
  distanceKm: number;
  city1: string;
  city2: string;
  message?: string;
}

export class CDSError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public response?: any
  ) {
    super(message);
    this.name = 'CDSError';
  }
}

export class CDSClient {
  private client: AxiosInstance;
  private config: Required<CDSClientConfig>;

  constructor(config: CDSClientConfig) {
    // Normalize base URL
    this.config = {
      baseURL: this.normalizeURL(config.baseURL),
      username: config.username || '',
      password: config.password || '',
      timeout: config.timeout || 30000,
      retries: config.retries || 3,
    };

    // Create axios instance
    this.client = axios.create({
      baseURL: this.config.baseURL,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    // Add authentication if provided
    if (this.config.username && this.config.password) {
      const auth = Buffer.from(
        `${this.config.username}:${this.config.password}`
      ).toString('base64');
      this.client.defaults.headers.common['Authorization'] = `Basic ${auth}`;
    }

    // Configure retry logic
    axiosRetry(this.client, {
      retries: this.config.retries,
      retryDelay: axiosRetry.exponentialDelay,
      retryCondition: (error: AxiosError) => {
        // Retry on network errors and specific HTTP errors
        if (axiosRetry.isNetworkOrIdempotentRequestError(error)) {
          return true;
        }
        
        // Retry on specific status codes
        const retryableStatuses = [408, 429, 500, 502, 503, 504];
        return error.response 
          ? retryableStatuses.includes(error.response.status)
          : false;
      },
      onRetry: (retryCount, error) => {
        console.warn(`Retry attempt ${retryCount} for ${error.config?.url}`);
      },
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        throw this.handleError(error);
      }
    );
  }

  /**
   * Normalize URL by adding protocol and removing trailing slashes
   */
  private normalizeURL(url: string): string {
    // Remove common prefixes that might be mistakenly included
    let normalized = url
      .replace(/^(https?:\/\/)?(www\.)?/, '')
      .replace(/\/$/, '');

    // Add https:// if no protocol specified
    if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
      normalized = `https://${normalized}`;
    }

    return normalized;
  }

  /**
   * Handle and transform errors into CDSError
   */
  private handleError(error: AxiosError): CDSError {
    if (error.response) {
      // Server responded with error status
      const status = error.response.status;
      const data = error.response.data as any;
      
      let message = data?.error || data?.message || error.message;
      
      // User-friendly messages for common errors
      switch (status) {
        case 400:
          message = `Invalid request: ${message}`;
          break;
        case 401:
          message = 'Authentication failed. Check your credentials.';
          break;
        case 403:
          message = 'Access forbidden. You do not have permission.';
          break;
        case 404:
          message = 'Resource not found. Check the endpoint URL.';
          break;
        case 429:
          message = 'Rate limit exceeded. Please try again later.';
          break;
        case 500:
        case 502:
        case 503:
        case 504:
          message = 'Server error. Please try again later.';
          break;
      }

      return new CDSError(message, status, data);
    } else if (error.request) {
      // Request made but no response
      return new CDSError(
        'No response from server. Check your network connection.',
        undefined,
        error.request
      );
    } else {
      // Error in request setup
      return new CDSError(error.message);
    }
  }

  /**
   * Get city suggestions based on partial name
   */
  async getSuggestions(query: string): Promise<CitySuggestion[]> {
    if (!query || query.length < 2) {
      throw new CDSError('Query must be at least 2 characters long');
    }

    const response = await this.client.get('/suggestions', {
      params: { q: query },
    });

    // Handle both response formats
    return response.data.data || response.data;
  }

  /**
   * Calculate distance between two cities
   */
  async calculateDistance(city1Id: string, city2Id: string): Promise<number> {
    if (!city1Id || !city2Id) {
      throw new CDSError('Both city IDs are required');
    }

    const response = await this.client.post('/distance', {
      City1: city1Id,
      City2: city2Id,
    });

    // Handle different response formats
    const data = response.data;
    return data.distanceKm || data.data || data;
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.client.get('/health_check');
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get API version
   */
  async getVersion(): Promise<string> {
    const response = await this.client.get('/version');
    return response.data;
  }
}

// Export everything
export default CDSClient;
