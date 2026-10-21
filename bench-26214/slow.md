**Slow items** (1 run each; the per-run interval is what bounds writes here, not item count):

| store | items × output | item time | c | variant | writes | bytes written | wall (ms) | bytes vs main | wall vs main |
|---|---|---|---|---|---|---|---|---|---|
| libsql | 300 × 32KB | 100 ms | 1 | main | 303 | 29 MB | 31,019 | 1.00× | 1.00× |
| libsql | 300 × 32KB | 100 ms | 1 | coalesce | 36 | 183 MB | 31,692 | 6.26× | 1.02× |
| pg | 300 × 32KB | 100 ms | 1 | main | 303 | 29 MB | 31,531 | 1.00× | 1.00× |
| pg | 300 × 32KB | 100 ms | 1 | coalesce | 35 | 176 MB | 30,977 | 6.02× | 0.98× |
| libsql | 100 × 32KB | 1 s | 10 | main | 103 | 9.7 MB | 10,169 | 1.00× | 1.00× |
| libsql | 100 × 32KB | 1 s | 10 | coalesce | 23 | 24 MB | 10,212 | 2.49× | 1.00× |
| pg | 100 × 32KB | 1 s | 10 | main | 103 | 9.7 MB | 10,288 | 1.00× | 1.00× |
| pg | 100 × 32KB | 1 s | 10 | coalesce | 23 | 24 MB | 10,263 | 2.49× | 1.00× |

So when items finish slowly, coalesced checkpoints write more bytes than main (2.5–6× here) and the ratio grows with run duration × progress size. Wall time is unchanged. Disk growth after VACUUM on PG: 0.6 → 2.7 MB and 0.27 → 0.48 MB.

**The original 400-item table, re-measured** (LibSQL, tiny outputs, concurrency 4, 1 run):

| | writes | bytes written | largest snapshot | wall (ms) |
|---|---|---|---|---|
| main | 403 | 827 KB | 27,267 | 160 |
| PR before review | 803 | 9.56 MB | 27,267 | 562 |
| PR now | 8 | 54 KB | 27,267 | 69 |
