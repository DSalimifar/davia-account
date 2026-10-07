# DAVIA ACCOUNT Database
PostgreSQL 16 is started by the root `docker-compose.yml`.
Database name: `davia_account`.
V1 uses `EnsureCreatedAsync()` for a fast first run. Before production this must be replaced with EF Core migrations and controlled deployment/migration.
