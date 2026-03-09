# Test Data Fixtures

This directory contains test data for the CDS backend. These fixtures help the backend start quickly during testing without needing to load full multilingual data.

## Structure

- `cities.json` - Sample city data for suggestions endpoint
- `languages.json` - Sample language configurations
- `README.md` - This file

## How to Use

1. Export your actual backend data using the scripts provided in your CDS backend repository
2. Place the exported JSON files in this directory
3. Configure your backend to use these fixtures when `TEST_MODE=true`

## Expected Data Format

### cities.json
```json
{
  "cities": [
    {
      "id": "12345",
      "name": "New York",
      "countryCode": "US",
      "country": "United States",
      "adminRegion": "New York",
      "population": 8405837,
      "flag": "US"
    }
  ]
}
```

### languages.json
```json
{
  "languages": [
    {
      "code": "en",
      "name": "English",
      "flag": "GB",
      "countryCode": "GB"
    },
    {
      "code": "de",
      "name": "German",
      "flag": "DE",
      "countryCode": "DE"
    }
  ]
}
```

## Test Mode Configuration

When running tests, set these environment variables:

```bash
TEST_MODE=true
CDS_FIXTURES_PATH=./tests/fixtures
```

This tells the backend to load data from fixtures instead of the full database/Elasticsearch.
