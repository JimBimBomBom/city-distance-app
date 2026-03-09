#!/bin/bash
# Debug script for database connection issues

echo "🔍 Debugging Database Connection"
echo "================================="
echo ""

echo "📋 Checking DefaultAppEnv.env:"
if [ -f "DefaultAppEnv.env" ]; then
    echo "File exists ✓"
    echo "Contents:"
    cat DefaultAppEnv.env | grep -v "^#" | grep -v "^$"
else
    echo "❌ DefaultAppEnv.env NOT FOUND"
fi

echo ""
echo "📋 Checking DefaultDatabaseEnv.env:"
if [ -f "DefaultDatabaseEnv.env" ]; then
    echo "File exists ✓"
    echo "Contents:"
    cat DefaultDatabaseEnv.env | grep -v "^#" | grep -v "^$"
else
    echo "❌ DefaultDatabaseEnv.env NOT FOUND"
fi

echo ""
echo "📋 Running Containers:"
docker compose -f docker-compose.test.yml ps

echo ""
echo "📋 MySQL Container Environment Variables:"
docker compose -f docker-compose.test.yml exec db env 2>/dev/null | grep -E "(MYSQL|PASSWORD)" || echo "Cannot exec into MySQL container"

echo ""
echo "📋 Testing MySQL Port Connectivity:"
docker compose -f docker-compose.test.yml exec cds-backend sh -c "nc -zv db 3306" 2>&1 || echo "Port connection test failed"

echo ""
echo "📋 MySQL Connection Test from Backend:"
docker compose -f docker-compose.test.yml exec cds-backend sh -c "mysql -h db -u root -pchangeme -e 'SELECT 1;'" 2>&1 || echo "MySQL connection failed"

echo ""
echo "📋 Backend Container Logs (last 50 lines):"
docker compose -f docker-compose.test.yml logs cds-backend --tail=50

echo ""
echo "📋 MySQL Container Logs (last 50 lines):"
docker compose -f docker-compose.test.yml logs db --tail=50

echo ""
echo "📋 Data Directory Contents:"
ls -la data/mysql/ 2>/dev/null | head -20 || echo "data/mysql/ is empty or missing"

echo ""
echo "================================="
echo "✅ Debug complete"
