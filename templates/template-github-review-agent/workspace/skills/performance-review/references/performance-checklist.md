# Performance Checklist

## Quick Reference

### Database

- [ ] No queries inside loops (N+1)
- [ ] Indexes exist for WHERE/JOIN/ORDER BY columns
- [ ] Queries have LIMIT clauses where appropriate
- [ ] Connection pooling is configured
- [ ] Expensive queries are cached

### Memory

- [ ] Event listeners are cleaned up
- [ ] Timers/intervals are cleared
- [ ] Caches have size limits or TTL
- [ ] Large data sets are paginated, not loaded entirely
- [ ] Streams used for large file processing

### Frontend

- [ ] Components memoized where appropriate
- [ ] Lists are virtualized if > 100 items
- [ ] Images are lazy-loaded and properly sized
- [ ] Code splitting for routes/features
- [ ] Heavy computation offloaded to web workers

### Network

- [ ] API responses are cached appropriately
- [ ] Parallel requests where dependencies allow
- [ ] Pagination for list endpoints
- [ ] Compression enabled (gzip/brotli)
- [ ] CDN for static assets

### General

- [ ] No synchronous I/O in request handlers
- [ ] Logging doesn't impact performance in production
- [ ] Batch operations where possible
- [ ] Debounce/throttle rapid-fire events
