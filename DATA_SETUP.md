# Using Your Own Data with CDS Backend

This setup allows you to use your own existing data from your CDS backend instead of waiting for it to load from external sources.

## 📁 Folder Structure

```
CDS-Client/
├── data/
│   ├── elasticsearch/     # Your ES data (indices, shards)
│   └── mysql/            # Your MySQL data (tables, records)
├── Resources/            # Language resources for backend
└── docker-compose.test.yml
```

## 🚀 Setup Instructions

### 1. Copy Your Data from Production/Local Backend

#### MySQL Data
From your running MySQL container or local MySQL instance:
```bash
# If using Docker, copy from container:
docker cp <mysql-container>:/var/lib/mysql ./data/mysql/

# Or if MySQL is running locally, copy the data directory:
# Windows: C:\ProgramData\MySQL\MySQL Server 8.0\Data\
# Linux: /var/lib/mysql/
# macOS: /usr/local/mysql/data/
```

**What to copy:**
- All `.ibd` files (InnoDB tablespaces)
- `ibdata1` (InnoDB system tablespace)
- `ib_logfile*` (redo logs)
- `mysql/` directory (system database)
- Your app database directory (e.g., `cds_db/`)

#### Elasticsearch Data
From your running ES container or local ES instance:
```bash
# If using Docker, copy from container:
docker cp <es-container>:/usr/share/elasticsearch/data ./data/elasticsearch/

# Or if ES is running locally:
# Windows: C:\ProgramData\Elastic\Elasticsearch\data\
# Linux: /var/lib/elasticsearch/
# macOS: /usr/local/var/lib/elasticsearch/
```

**What to copy:**
- `nodes/` directory (contains all indices and shards)
- `_state/` directory (cluster state)

#### Resources Folder (Languages)
From your CDS backend project:
```bash
# Copy your Resources folder that contains language files:
cp -r /path/to/your/cds-backend/Resources ./Resources/
```

**Structure should be:**
```
Resources/
├── languages/
│   ├── en.json
│   ├── de.json
│   ├── fr.json
│   └── ...
└── ... (other resource files)
```

### 2. Set Permissions (Important!)

MySQL and Elasticsearch need proper ownership of their data folders:

#### On Linux/macOS:
```bash
# MySQL runs as user 999 (mysql)
sudo chown -R 999:999 ./data/mysql

# Elasticsearch runs as user 1000 (elasticsearch)
sudo chown -R 1000:1000 ./data/elasticsearch
```

#### On Windows:
No special permissions needed, but ensure Docker Desktop has access to the folders.

### 3. Start the Backend

```bash
npm run backend:start
```

The containers will now use your data directly - no waiting for Wikidata or other sources!

## ⚠️ Important Notes

### Data Compatibility
- **MySQL Version**: Your data should be from MySQL 8.0 (same as container)
- **ES Version**: Your data should be from Elasticsearch 8.15.0 (same as container)
- **Architecture**: Data from x86_64 should work on both Intel and AMD processors

### First Time Setup
If you're starting fresh:
1. Start containers once without data to initialize
2. Let them load data from your sources
3. Copy the generated data out:
   ```bash
   docker cp cds_mysql_db:/var/lib/mysql ./data/
   docker cp elasticsearch:/usr/share/elasticsearch/data ./data/
   ```
4. Now you have reusable data!

### Updating Data
If you need to refresh the data:
```bash
# Stop containers
npm run backend:stop

# Remove old data
rm -rf ./data/mysql/* ./data/elasticsearch/*

# Copy new data
# ... (copy commands above)

# Start again
npm run backend:start
```

### Troubleshooting

**MySQL fails to start:**
- Check permissions: `ls -la ./data/mysql`
- Ensure no port conflicts: `lsof -i :3306`
- Check logs: `npm run backend:logs`

**Elasticsearch fails to start:**
- Check disk space: Elasticsearch needs space for transient operations
- Ensure memory: At least 2GB available for the container
- Check permissions on data folder

**Permission denied errors:**
- Windows: Run PowerShell as Administrator
- Linux/Mac: Use `sudo chown` commands above

## 🔒 Data Safety

Your data folders are:
- ✅ **Ignored by Git** (in .gitignore)
- ✅ **Persistent** (survives container restarts)
- ✅ **Portable** (can be copied between machines)
- ✅ **Backed up** by you (keep copies!)

## 🧪 Testing with Your Data

Once your data is loaded:

```bash
# Start everything
npm run backend:start

# Run tests against your real data
npm run test:e2e
```

The tests will use actual cities from your database!

## 📦 Data Backup

Before major changes, backup your data:
```bash
# Create backup
tar -czvf cds-data-backup-$(date +%Y%m%d).tar.gz ./data/ ./Resources/

# Restore from backup
tar -xzvf cds-data-backup-20260309.tar.gz
```

## 🎯 CI/CD Usage

For GitHub Actions, you can:
1. Commit your data to a private repository
2. Use GitHub Actions artifacts to cache the data
3. Or use a data volume in your CI pipeline

See `.github/workflows/deploy_pages.yml` for the CI configuration.

## 💡 Pro Tips

1. **Keep data minimal for CI**: Only include cities needed for tests
2. **Use compression**: `gzip` your data folders before transferring
3. **Version control**: Keep different data sets for different test scenarios
4. **Clean shutdown**: Always run `npm run backend:stop` before copying data

---

**Need help?** Check the backend logs:
```bash
npm run backend:logs
```
