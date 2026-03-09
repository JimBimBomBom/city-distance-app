#!/bin/bash
# Reset MySQL root password to match DefaultAppEnv.env

PASSWORD=${MYSQL_ROOT_PASSWORD:-changeme}

echo "🔐 Resetting MySQL root password to: $PASSWORD"
echo ""

# Start MySQL with --skip-grant-tables to bypass authentication
docker compose -f docker-compose.test.yml exec db bash -c "
  # Stop MySQL temporarily
  mysqladmin shutdown 2>/dev/null || true
  sleep 2
  
  # Start with skip-grant-tables
  mysqld --skip-grant-tables --skip-networking &
  sleep 5
  
  # Reset password
  mysql -u root << EOF
    FLUSH PRIVILEGES;
    ALTER USER 'root'@'localhost' IDENTIFIED BY '$PASSWORD';
    ALTER USER 'root'@'%' IDENTIFIED BY '$PASSWORD';
    FLUSH PRIVILEGES;
EOF
  
  # Restart MySQL normally
  mysqladmin shutdown 2>/dev/null || true
"

# Restart the MySQL container
docker compose -f docker-compose.test.yml restart db

echo "✅ Password reset complete. MySQL will restart."
echo "Wait 30 seconds for MySQL to be ready, then start the backend."
