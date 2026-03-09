# CDS Client - Bun Migration Guide

This project now uses **Bun** for package management and builds, offering significantly faster performance while maintaining full compatibility with Node.js for Playwright testing.

## 🚀 Why Bun?

- **5-10x faster** package installation (`bun install` vs `npm install`)
- **3-4x faster** startup and build times
- **Built-in TypeScript** support (no ts-node needed)
- **All-in-one toolchain**: package manager, bundler, and test runner
- **Full npm compatibility**: Works with existing `package.json` and `node_modules`

## 📦 Installation

### Install Bun (if not already installed)

**macOS/Linux:**
```bash
curl -fsSL https://bun.sh/install | bash
```

**Windows (PowerShell):**
```powershell
powershell -c "irm bun.sh/install.ps1 | iex"
```

### Install Dependencies

```bash
bun install
```

That's it! Bun will read your `package.json` and install dependencies into `node_modules/`.

## 🏃 Quick Start

### Development
```bash
# Build the package
bun run build

# Or use Bun's built-in bundler (experimental)
bun run build:bun
```

### Testing

We use a hybrid approach for testing:

#### Unit Tests (Bun)
```bash
# Run Bun's built-in test runner
bun test
```

#### E2E Tests (Node.js + Playwright)
Playwright requires Node.js for full compatibility:

```bash
# Start the backend Docker container and run tests
npm run test:e2e:ci

# Or manually:
npm run backend:start    # Start backend Docker container
npm run test:e2e       # Run Playwright tests
npm run backend:stop   # Stop backend
```

## 🐳 Docker Backend for Testing

The CDS backend is available as a Docker image for local testing, with MySQL and Elasticsearch support:

### Services Included

1. **cds-backend** - The main CDS API (port 8080)
2. **mysql** - MySQL database for persistent storage
3. **elasticsearch** - Elasticsearch for fast city search

### Start Backend
```bash
# Cross-platform (uses Node.js script)
npm run backend:start

# Windows PowerShell alternative
npm run backend:start:win

# Manual Docker command
docker-compose -f docker-compose.test.yml up -d
```

### Check Backend Status
```bash
# The backend will be available at:
curl http://localhost:8080/health_check

# MySQL database
curl http://localhost:3306

# Elasticsearch
curl http://localhost:9200/_cluster/health

# View logs
npm run backend:logs
```

### Stop Backend
```bash
npm run backend:stop
```

### Data Persistence

MySQL and Elasticsearch data is persisted in the `./data/` directory:
- `./data/mysql/` - MySQL database files
- `./data/elasticsearch/` - Elasticsearch indices

This allows you to restart containers without losing data.

## 📁 Project Structure

```
CDS-Client/
├── src/                    # Package source code
│   ├── index.ts           # Main CDSClient class
│   ├── utils.ts           # FlagUtils & FormatUtils
│   └── react-hooks.ts     # React integration
├── website/               # Website (HTML/CSS/JS)
│   └── index.html         # Main website file
├── tests/
│   ├── e2e/              # Playwright E2E tests
│   │   └── website.spec.ts
│   └── fixtures/         # Test data for backend
│       ├── cities.json
│       └── languages.json
├── scripts/              # Helper scripts
│   ├── wait-for-backend.js
│   ├── start-backend.sh
│   └── start-backend.ps1
├── docker-compose.test.yml   # Backend container config
├── playwright.config.ts      # Playwright configuration
└── package.json            # Dependencies and scripts
```

## 🔧 Available Scripts

### Build
```bash
bun run build          # Build with tsup (recommended)
bun run build:bun      # Build with Bun's bundler (experimental)
```

### Test
```bash
# Unit tests
bun test               # Bun's test runner
npm run test           # Jest (Node.js)

# E2E tests
npm run test:e2e       # Run Playwright tests
npm run test:e2e:ui    # Run with UI mode (debugging)
npm run test:e2e:ci    # Full CI workflow with backend
```

### Backend (Docker)
```bash
npm run backend:start     # Start backend container
npm run backend:start:win # Windows PowerShell version
npm run backend:stop      # Stop backend
npm run backend:logs      # View logs
```

## 🔄 CI/CD Pipeline

The GitHub Actions workflow:

1. **Uses Bun** for dependency installation and package building (fast)
2. **Starts CDS backend** in Docker container (`jimbimdocker/city-distance-service:latest`)
3. **Uses Node.js** for Playwright tests (compatibility)
4. **Runs E2E tests** against the real backend
5. **Deploys to GitHub Pages** only if all tests pass

### Workflow Features

- **Parallel execution**: Bun installs and Docker setup happen in parallel
- **Health checks**: Waits for backend to be ready before testing
- **Artifact uploads**: Test reports and screenshots saved for debugging
- **Automatic cleanup**: Backend container stopped after tests

## 📝 Migration Notes

### What Changed?

1. **Package Management**: Now uses Bun (`bun.lockb` lockfile)
2. **Build Process**: Supports both tsup and Bun bundler
3. **Testing**: Hybrid approach (Bun for unit, Node.js for Playwright)
4. **Backend**: Docker container for local testing with real data

### What Stayed the Same?

- `package.json` format (fully compatible)
- `node_modules/` directory structure
- TypeScript configuration
- Playwright tests (unchanged)
- Website functionality

## 🐛 Troubleshooting

### Bun not found
```bash
# Add Bun to your PATH
export PATH="$HOME/.bun/bin:$PATH"  # macOS/Linux
```

### Playwright tests failing
```bash
# Reinstall Playwright browsers
npx playwright install chromium

# Check if backend is running
curl http://localhost:8080/health_check
```

### Docker backend won't start
```bash
# Check Docker is running
docker ps

# View backend logs
docker-compose -f docker-compose.test.yml logs

# Ensure port 8080 is free
lsof -i :8080  # macOS/Linux
netstat -ano | findstr :8080  # Windows
```

### Lockfile conflicts
If switching between npm and Bun:
```bash
# Remove both lockfiles and regenerate with Bun
rm package-lock.json bun.lockb
bun install
```

## 📚 Additional Resources

- [Bun Documentation](https://bun.sh/docs)
- [Playwright Documentation](https://playwright.dev/)
- [Docker Compose](https://docs.docker.com/compose/)
- [CDS Backend Docker Hub](https://hub.docker.com/r/jimbimdocker/city-distance-service)

## 🤝 Contributing

When contributing:

1. Use `bun install` to add dependencies
2. Commit `bun.lockb` for reproducible builds
3. Test locally with `npm run test:e2e:ci` before pushing
4. Ensure Playwright tests pass with the Docker backend
