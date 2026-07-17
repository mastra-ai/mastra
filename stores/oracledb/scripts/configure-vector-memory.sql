-- Sizes the Oracle Vector Pool used by HNSW vector indexes.
--
-- Exact search (the OracleVector default) and IVF indexes do not use the Vector Pool and work
-- fine with VECTOR_MEMORY_SIZE = 0; this script only matters for HNSW.
--
-- VECTOR_MEMORY_SIZE cannot be set with SCOPE=MEMORY here: it must be configured at the CDB
-- root, and the running instance only picks it up after a restart. SCOPE=SPFILE persists the
-- value to the parameter file for the next startup; it does NOT take effect until the database
-- is restarted (`docker compose restart db` once, after the container finishes initializing).
--
-- Any failure here should be visible (not swallowed) so a misconfigured Vector Pool is caught
-- immediately instead of surfacing later as an opaque HNSW build failure.
WHENEVER SQLERROR EXIT SQL.SQLCODE

-- gvenzl/oracle-free init scripts run as SYS in the CDB root by default.
ALTER SYSTEM SET VECTOR_MEMORY_SIZE = 256M SCOPE=SPFILE;
