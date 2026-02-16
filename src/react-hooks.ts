import { useState, useCallback } from 'react';
import { CDSClient, CitySuggestion, CDSError } from './index';

export interface UseCDSOptions {
  client: CDSClient;
  onError?: (error: CDSError) => void;
}

export function useCitySuggestions(options: UseCDSOptions) {
  const [suggestions, setSuggestions] = useState<CitySuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<CDSError | null>(null);

  const search = useCallback(
    async (query: string) => {
      if (query.length < 2) {
        setSuggestions([]);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const results = await options.client.getSuggestions(query);
        setSuggestions(results);
      } catch (err) {
        const error = err as CDSError;
        setError(error);
        if (options.onError) {
          options.onError(error);
        }
      } finally {
        setLoading(false);
      }
    },
    [options]
  );

  return { suggestions, loading, error, search };
}

export function useDistanceCalculation(options: UseCDSOptions) {
  const [distance, setDistance] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<CDSError | null>(null);

  const calculate = useCallback(
    async (city1Id: string, city2Id: string) => {
      setLoading(true);
      setError(null);
      setDistance(null);

      try {
        const result = await options.client.calculateDistance(city1Id, city2Id);
        setDistance(result);
      } catch (err) {
        const error = err as CDSError;
        setError(error);
        if (options.onError) {
          options.onError(error);
        }
      } finally {
        setLoading(false);
      }
    },
    [options]
  );

  return { distance, loading, error, calculate };
}