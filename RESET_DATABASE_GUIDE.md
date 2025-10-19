# Database Reset Guide

This guide will help you completely reset your database and migrations.

## Steps to Reset

### 1. Drop All Tables and Enums (DESTRUCTIVE - YOU WILL LOSE ALL DATA!)

You have two options:

#### Option A: Using psql command line
```bash
# Make sure your database is running
./start-database.sh

# Connect to your database and run the reset script
# Replace the connection details with your DATABASE_URL from .env
psql "your_database_url_here" -f reset-db.sql
```

#### Option B: Using psql with environment variable
```bash
# Make sure your database is running
./start-database.sh

# Source your .env file
source .env

# Run the reset script
psql "$DATABASE_URL" -f reset-db.sql
```

#### Option C: Drop and recreate the entire database (nuclear option)
```bash
# Stop and remove the container completely
docker stop assignment-postgres && docker rm assignment-postgres

# Start fresh
./start-database.sh
```

### 2. Generate Fresh Migrations

After dropping all tables, generate new migrations from your current schema:

```bash
npm run db:generate
```

This will create a fresh migration file in the `drizzle/` folder based on your current `src/server/db/schema.ts`.

### 3. Apply Fresh Migrations

Apply the newly generated migrations to your clean database:

```bash
npm run db:push
```

Or if you prefer using migrate:

```bash
npm run db:migrate
```

### 4. Verify Everything Works

Check your database has the correct tables:

```bash
npm run db:studio
```

This will open Drizzle Studio where you can verify all tables are created correctly.

## What Was Done

1. ✅ Deleted all old migration files (`drizzle/0000_*.sql`, `drizzle/0001_*.sql`)
2. ✅ Deleted migration metadata (`drizzle/meta/*.json`)
3. ✅ Created `reset-db.sql` script to drop all tables and enums
4. 📝 You need to: Run the SQL script against your database
5. 📝 You need to: Generate fresh migrations
6. 📝 You need to: Apply fresh migrations

## Current Schema

Your current schema includes:
- `users` table
- `workspaces` table
- `memberships` table (join table)
- `videoJobs` table
- `payments` table
- 3 enums: `membership_role`, `video_job_status`, `payment_status`

## Troubleshooting

### If psql command is not found
Install PostgreSQL client:
```bash
sudo apt-get install postgresql-client
```

### If you want to start completely fresh
The easiest way is Option C above - just delete and recreate the Docker container:
```bash
docker stop assignment-postgres
docker rm assignment-postgres
./start-database.sh
```

Then proceed with steps 2 and 3.

